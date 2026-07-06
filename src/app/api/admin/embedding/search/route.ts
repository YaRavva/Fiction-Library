import { type NextRequest, NextResponse } from "next/server";
import {
	cosineSimilarity,
	generateEmbedding,
	prepareBookText,
} from "@/lib/embedding-service";
import { serverSupabase } from "@/lib/serverSupabase";

/**
 * POST /api/admin/embedding/search
 * Search for books matching a filename using vector similarity
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			filename,
			title,
			author,
			model,
			limit = 10,
			threshold = 0.4,
		} = body;

		if (!filename) {
			return NextResponse.json(
				{ error: "filename is required" },
				{ status: 400 },
			);
		}

		// Prepare text from filename or title+author
		const searchText =
			title && author
				? prepareBookText(title, author)
				: filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

		// Generate embedding for search text
		const searchResult = await generateEmbedding(searchText, { model });
		const queryEmbedding = searchResult.embedding;

		// Try using the PostgreSQL function first
		try {
			const { data: vectorResults, error: vectorError } =
				await serverSupabase.rpc("match_books", {
					query_embedding: `[${queryEmbedding.join(",")}]`,
					match_threshold: threshold,
					match_count: limit,
				});

			if (!vectorError && vectorResults && vectorResults.length > 0) {
				return NextResponse.json({
					matches: vectorResults.map((r: any) => ({
						id: r.id,
						title: r.title,
						author: r.author,
						score: r.similarity,
						method: "vector",
					})),
					query: searchText,
					model: searchResult.model,
				});
			}
		} catch (rpcError) {
			console.warn(
				"Vector search function not available, falling back to cosine similarity",
			);
		}

		// Fallback: fetch all books with embeddings and compute similarity
		const { data: books, error: fetchError } = await serverSupabase
			.from("books")
			.select("id, title, author, embedding")
			.not("embedding", "is", null)
			.not("title", "is", null)
			.not("author", "is", null)
			.limit(1000);

		if (fetchError) {
			throw new Error(`Failed to fetch books: ${fetchError.message}`);
		}

		if (!books || books.length === 0) {
			return NextResponse.json({
				matches: [],
				query: searchText,
				model: searchResult.model,
				message: "No books with embeddings found",
			});
		}

		// Calculate cosine similarity for each book
		const matches = books
			.map((book) => {
				// Parse embedding from string format "[1,2,3...]"
				const embeddingStr = book.embedding as string;
				const embedding = embeddingStr
					.replace(/[[\]]/g, "")
					.split(",")
					.map(Number);

				const similarity = cosineSimilarity(queryEmbedding, embedding);

				return {
					id: book.id,
					title: book.title,
					author: book.author,
					score: similarity,
					method: "cosine",
				};
			})
			.filter((m) => m.score > threshold)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		return NextResponse.json({
			matches,
			query: searchText,
			model: searchResult.model,
		});
	} catch (error: any) {
		console.error("Error searching by embedding:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to search" },
			{ status: 500 },
		);
	}
}
