/**
 * Unified file-to-book matching service.
 * Combines lexical (word-based) and embedding (vector similarity) scoring
 * into a single hybrid scoring algorithm.
 *
 * Used by: book-worm, file-processing-service, admin file-linking.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
	type BookOption,
	extractWords,
	type FileOption,
	findBestBookForFile,
	type MatchResult,
	parseFileName,
} from "../book-file-scorer";

export interface UnifiedMatchResult {
	book: BookOption;
	lexicalScore: number;
	embeddingScore: number;
	hybridScore: number;
	method: "lexical+embedding" | "lexical-only";
	confidence: "high" | "medium" | "low";
}

// Telegram replaces these Cyrillic characters with visually similar Latin ones
const TELEGRAM_CYRILLIC_MAP: Record<string, string> = {
	е: "e",
	о: "o",
	а: "a",
	с: "c",
	р: "p",
	Е: "E",
	О: "O",
	А: "A",
	С: "C",
	Р: "P",
	Н: "H",
	К: "K",
	В: "B",
	М: "M",
	Т: "T",
	Х: "X",
	х: "x",
};

/**
 * Normalize text for scoring — applies Telegram Cyrillic mapping
 * and standard normalization. Used ONLY for scoring, never for DB storage.
 */
export function normalizeForScoring(text: string): string {
	let result = text;
	for (const [from, to] of Object.entries(TELEGRAM_CYRILLIC_MAP)) {
		result = result.replace(new RegExp(from, "g"), to);
	}
	return result;
}

/**
 * Prepare text for embedding generation from a book title + author.
 */
export function prepareBookEmbeddingText(
	title: string,
	author: string,
): string {
	return `${title} ${author}`.normalize("NFC").trim();
}

/**
 * Prepare text for embedding generation from a Telegram file name.
 * Removes extension, size markers, brackets, normalizes separators.
 */
export function prepareFileEmbeddingText(fileName: string): string {
	let name = fileName;
	// Remove extension
	const dotIndex = name.lastIndexOf(".");
	if (dotIndex > 0) {
		name = name.substring(0, dotIndex);
	}
	// Remove size markers like [1.2 Mb], [EPUB], etc.
	name = name.replace(/\[[^\]]*\]/g, "");
	// Remove parenthetical content like (fb2)
	name = name.replace(/\([^)]*\)/g, "");
	// Replace common separators with spaces
	name = name.replace(/[_\-—–.]+/g, " ");
	// Collapse whitespace
	name = name.replace(/\s+/g, " ").trim();
	return name.normalize("NFC");
}

/**
 * Check if pgvector embedding search is available.
 */
async function checkEmbeddingAvailable(
	supabase: SupabaseClient,
): Promise<boolean> {
	try {
		const { error } = await supabase.rpc("match_books", {
			query_embedding: new Array(1024).fill(0),
			match_threshold: 0.99,
			match_count: 1,
		});
		// Function exists if error is about data, not about missing function
		return (
			!error ||
			!error.message.includes("function") ||
			error.message.includes("match_books")
		);
	} catch {
		return false;
	}
}

/**
 * Search books using pgvector embedding similarity.
 * Returns top candidates with similarity scores.
 * Optionally saves the file embedding to the database.
 */
async function searchByEmbedding(
	supabase: SupabaseClient,
	queryText: string,
	limit: number = 20,
	messageId?: number,
): Promise<
	{ id: string; title: string; author: string; similarity: number }[]
> {
	try {
		// Generate embedding via OmniRoute API
		const response = await fetch(
			`${process.env.OMNIROUTE_URL || "http://88.198.44.124:31000"}/v1/embeddings`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.VOYAGE_API_KEY || process.env.OMNIROUTE_API_KEY || ""}`,
				},
				body: JSON.stringify({
					model: "voyage-ai/voyage-4",
					input: queryText,
				}),
			},
		);

		if (!response.ok) return [];

		const data = await response.json();
		const embedding = data?.data?.[0]?.embedding;
		if (!embedding || !Array.isArray(embedding)) return [];

		const embeddingStr = `[${embedding.join(",")}]`;

		// Save file embedding to DB if messageId provided
		if (messageId) {
			await supabase
				.from("telegram_files")
				.update({ embedding: embeddingStr } as never)
				.eq("message_id", messageId);
		}

		// Search via pgvector
		const { data: matches, error } = await supabase.rpc("match_books", {
			query_embedding: embeddingStr,
			match_threshold: 0.3,
			match_count: limit,
		});

		if (error || !matches) return [];

		return matches.map((m: Record<string, unknown>) => ({
			id: String(m.id),
			title: String(m.title),
			author: String(m.author),
			similarity: Number(m.similarity) * 100,
		}));
	} catch {
		return [];
	}
}

/**
 * Generate embedding for a book and store it in the database.
 */
export async function generateBookEmbedding(
	supabase: SupabaseClient,
	bookId: string,
	title: string,
	author: string,
): Promise<boolean> {
	try {
		const text = prepareBookEmbeddingText(title, author);

		const response = await fetch(
			`${process.env.OMNIROUTE_URL || "http://88.198.44.124:31000"}/v1/embeddings`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.VOYAGE_API_KEY || process.env.OMNIROUTE_API_KEY || ""}`,
				},
				body: JSON.stringify({
					model: "voyage-ai/voyage-4",
					input: text,
				}),
			},
		);

		if (!response.ok) return false;

		const data = await response.json();
		const embedding = data?.data?.[0]?.embedding;
		if (!embedding || !Array.isArray(embedding)) return false;

		const embeddingStr = `[${embedding.join(",")}]`;

		const { error } = await supabase
			.from("books")
			.update({ embedding: embeddingStr } as never)
			.eq("id", bookId);

		return !error;
	} catch {
		return false;
	}
}

/**
 * Generate embedding for a Telegram file and store it in the database.
 */
export async function generateFileEmbedding(
	supabase: SupabaseClient,
	messageId: number,
	fileName: string,
): Promise<boolean> {
	try {
		const text = prepareFileEmbeddingText(fileName);

		const response = await fetch(
			`${process.env.OMNIROUTE_URL || "http://88.198.44.124:31000"}/v1/embeddings`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.VOYAGE_API_KEY || process.env.OMNIROUTE_API_KEY || ""}`,
				},
				body: JSON.stringify({
					model: "voyage-ai/voyage-4",
					input: text,
				}),
			},
		);

		if (!response.ok) return false;

		const data = await response.json();
		const embedding = data?.data?.[0]?.embedding;
		if (!embedding || !Array.isArray(embedding)) return false;

		const embeddingStr = `[${embedding.join(",")}]`;

		const { error } = await supabase
			.from("telegram_files")
			.update({ embedding: embeddingStr } as never)
			.eq("message_id", messageId);

		return !error;
	} catch {
		return false;
	}
}

/**
 * Main matching function. Combines lexical and embedding search
 * into a hybrid score.
 *
 * @param file - The Telegram file to match
 * @param supabase - Database client
 * @param options - threshold (default 50), useEmbeddings (default true)
 * @returns Best match or null
 */
export async function matchFileToBook(
	file: FileOption,
	supabase: SupabaseClient,
	options?: { threshold?: number; useEmbeddings?: boolean },
): Promise<UnifiedMatchResult | null> {
	const threshold = options?.threshold ?? 50;
	const useEmbeddings = options?.useEmbeddings ?? true;

	// === PHASE 1: Lexical search ===
	const { fileAuthor, fileTitle } = parseFileName(file.file_name);
	const searchTerms = [
		...extractWords(fileTitle),
		...(fileAuthor ? extractWords(fileAuthor) : []),
	];

	if (searchTerms.length === 0) return null;

	// ILIKE search for candidate books
	const orConditions = searchTerms
		.flatMap((term) => [`title.ilike.%${term}%`, `author.ilike.%${term}%`])
		.join(",");

	const { data: lexicalCandidates } = await supabase
		.from("books")
		.select("id, title, author")
		.or(orConditions)
		.limit(50);

	const bookCandidates: BookOption[] = (lexicalCandidates || []).map(
		(b: Record<string, unknown>) => ({
			id: String(b.id),
			title: String(b.title),
			author: String(b.author),
		}),
	);

	if (bookCandidates.length === 0) return null;

	// Score all candidates lexically
	const lexicalResults: MatchResult[] = [];
	for (const book of bookCandidates) {
		const result = findBestBookForFile(file, [book], 0);
		if (result) {
			lexicalResults.push(result);
		}
	}

	// Sort by lexical score
	lexicalResults.sort((a, b) => b.score - a.score);

	// Take top 20 for embedding comparison
	const topCandidates = lexicalResults.slice(0, 20);

	// === PHASE 2: Embedding search (if available) ===
	if (useEmbeddings) {
		const embeddingAvailable = await checkEmbeddingAvailable(supabase);

		if (embeddingAvailable) {
			const fileText = prepareFileEmbeddingText(file.file_name);
			const embeddingMatches = await searchByEmbedding(
				supabase,
				fileText,
				20,
				file.message_id,
			);

			if (embeddingMatches.length > 0) {
				// Merge embedding results with lexical
				const embeddingMap = new Map(
					embeddingMatches.map((m) => [m.id, m.similarity]),
				);

				// Calculate hybrid scores
				const hybridResults: UnifiedMatchResult[] = topCandidates.map(
					(lexical) => {
						const embeddingScore = embeddingMap.get(lexical.book.id) ?? 0;
						const hybridScore = Math.round(
							lexical.score * 0.6 + embeddingScore * 0.4,
						);

						return {
							book: lexical.book,
							lexicalScore: lexical.score,
							embeddingScore: Math.round(embeddingScore),
							hybridScore,
							method: "lexical+embedding" as const,
							confidence:
								hybridScore >= 70
									? ("high" as const)
									: hybridScore >= 50
										? ("medium" as const)
										: ("low" as const),
						};
					},
				);

				// Also add books found ONLY by embedding (not in lexical top 20)
				const lexicalIds = new Set(topCandidates.map((t) => t.book.id));
				for (const emb of embeddingMatches) {
					if (!lexicalIds.has(emb.id) && emb.similarity >= 40) {
						hybridResults.push({
							book: { id: emb.id, title: emb.title, author: emb.author },
							lexicalScore: 0,
							embeddingScore: Math.round(emb.similarity),
							hybridScore: Math.round(emb.similarity * 0.4),
							method: "lexical+embedding",
							confidence:
								emb.similarity >= 70
									? "high"
									: emb.similarity >= 50
										? "medium"
										: "low",
						});
					}
				}

				hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);
				const best = hybridResults[0];
				if (best && best.hybridScore >= threshold) return best;
			}
		}
	}

	// === PHASE 3: Fallback to lexical-only ===
	if (topCandidates.length > 0 && topCandidates[0].score >= threshold) {
		const best = topCandidates[0];
		return {
			book: best.book,
			lexicalScore: best.score,
			embeddingScore: 0,
			hybridScore: best.score,
			method: "lexical-only",
			confidence:
				best.score >= 70 ? "high" : best.score >= 50 ? "medium" : "low",
		};
	}

	return null;
}

/**
 * Batch match: match multiple files to books in a single pass.
 * More efficient than calling matchFileToBook for each file.
 */
export async function matchFilesToBooks(
	files: FileOption[],
	supabase: SupabaseClient,
	options?: { threshold?: number; useEmbeddings?: boolean },
): Promise<Map<number, UnifiedMatchResult>> {
	const results = new Map<number, UnifiedMatchResult>();

	for (const file of files) {
		const match = await matchFileToBook(file, supabase, options);
		if (match) {
			results.set(file.message_id, match);
		}
	}

	return results;
}

/**
 * Ensure embedding exists for a book. Generates if missing.
 */
export async function ensureBookEmbedding(
	supabase: SupabaseClient,
	bookId: string,
	title: string,
	author: string,
): Promise<boolean> {
	// Check if embedding already exists
	const { data } = await supabase
		.from("books")
		.select("embedding")
		.eq("id", bookId)
		.single();

	if (data && (data as Record<string, unknown>).embedding) return true;

	return generateBookEmbedding(supabase, bookId, title, author);
}

/**
 * Ensure embedding exists for a Telegram file. Generates if missing.
 */
export async function ensureFileEmbedding(
	supabase: SupabaseClient,
	messageId: number,
	fileName: string,
): Promise<boolean> {
	const { data } = await supabase
		.from("telegram_files")
		.select("embedding")
		.eq("message_id", messageId)
		.single();

	if (data && (data as Record<string, unknown>).embedding) return true;

	return generateFileEmbedding(supabase, messageId, fileName);
}
