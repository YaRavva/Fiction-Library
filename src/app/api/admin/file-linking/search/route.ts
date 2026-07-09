import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import type { Database } from "@/lib/database.types";
import {
	type BookOption,
	type FileOption,
	scoreFileToBook,
} from "@/lib/book-file-scorer";
import {
	DEFAULT_EMBEDDING_MODEL,
	generateEmbedding,
	prepareBookText,
} from "@/lib/embedding-service";

interface TelegramFileCandidate {
	message_id: number | string;
	file_name: string;
	mime_type?: string | null;
	file_size?: number | null;
	similarity?: number | null;
}

function toMessageId(value: number | string): number {
	return typeof value === "number" ? value : Number.parseInt(value, 10);
}

function normalizeFileNameForEmbedding(fileName: string): string {
	return fileName
		.normalize("NFC")
		.replace(/\.[^/.]+$/, "")
		.replace(/[_-]/g, " ")
		.toLowerCase()
		.trim();
}

function mergeCandidates(
	vectorCandidates: TelegramFileCandidate[],
	lexicalCandidates: TelegramFileCandidate[],
): TelegramFileCandidate[] {
	const byId = new Map<number, TelegramFileCandidate>();

	for (const candidate of lexicalCandidates) {
		byId.set(toMessageId(candidate.message_id), candidate);
	}

	for (const candidate of vectorCandidates) {
		const messageId = toMessageId(candidate.message_id);
		const existing = byId.get(messageId);
		byId.set(messageId, { ...existing, ...candidate });
	}

	return Array.from(byId.values());
}

function combineScores(lexicalScore: number, vectorSimilarity?: number | null) {
	if (typeof vectorSimilarity !== "number") {
		return { score: lexicalScore, vectorScore: null };
	}

	const vectorScore = Math.round(vectorSimilarity * 100);
	return {
		score: Math.round(lexicalScore * 0.75 + vectorScore * 0.25),
		vectorScore,
	};
}

export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;
		const typedAdmin = auth.admin as any;

		const body = await request.json();
		const { title, author, limit = 10, model = DEFAULT_EMBEDDING_MODEL } = body;

		if (!title || !author) {
			return NextResponse.json(
				{ error: "title and author are required" },
				{ status: 400 },
			);
		}

		const bookOption: BookOption = {
			id: "selected",
			title,
			author,
		};

		let vectorCandidates: TelegramFileCandidate[] = [];
		let vectorReady = false;

		try {
			const queryText = prepareBookText(title, author);
			const queryEmbedding = await generateEmbedding(queryText, { model });

			const { data, error } = await typedAdmin.rpc(
				"match_telegram_files",
				{
					query_embedding: `[${queryEmbedding.embedding.join(",")}]`,
					match_threshold: 0.35,
					match_count: 250,
				},
			);

			if (!error && data) {
				vectorCandidates = data as TelegramFileCandidate[];
				vectorReady = vectorCandidates.length > 0;
			}
		} catch (error) {
			console.warn("Vector file search unavailable:", error);
		}

		const { data: lexicalCandidates, error: filesError } = await auth.admin
			.from("telegram_files")
			.select("message_id, file_name, mime_type, file_size")
			.is("duplicate_of_message_id", null)
			.not("file_name", "is", null)
			.order("message_id", { ascending: false })
			.limit(5000);

		if (filesError) {
			throw new Error(`Failed to fetch files: ${filesError.message}`);
		}

		const candidates = mergeCandidates(
			vectorCandidates,
			(lexicalCandidates || []) as TelegramFileCandidate[],
		);

		const matches = candidates
			.map((file) => {
				const fileOption: FileOption = {
					message_id: toMessageId(file.message_id),
					file_name: file.file_name,
					mime_type: file.mime_type || undefined,
					file_size: file.file_size || undefined,
				};
				const lexical = scoreFileToBook(fileOption, bookOption);
				const combined = combineScores(lexical.score, file.similarity);

				let score = combined.score;
				if (lexical.score < 40) score = Math.min(score, 39);
				if (!lexical.authorMatch && lexical.titleMatchCount < 2) {
					score = Math.min(score, 45);
				}

				return {
					message_id: fileOption.message_id,
					filename: file.file_name,
					score,
					lexicalScore: lexical.score,
					vectorScore: combined.vectorScore,
					matchedWords: lexical.matchedWords,
					titleMatchCount: lexical.titleMatchCount,
					authorMatch: lexical.authorMatch,
					fileAuthorParsed: lexical.fileAuthorParsed,
					fileTitleParsed: lexical.fileTitleParsed,
					method: combined.vectorScore === null ? "lexical" : "hybrid",
					embeddingText: normalizeFileNameForEmbedding(file.file_name),
				};
			})
			.filter((file) => file.score >= 40)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return (b.vectorScore || 0) - (a.vectorScore || 0);
			})
			.slice(0, limit);

		return NextResponse.json({
			matches,
			vectorReady,
			model,
		});
	} catch (error: unknown) {
		console.error("Error searching file matches:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to search matches" },
			{ status: 500 },
		);
	}
}
