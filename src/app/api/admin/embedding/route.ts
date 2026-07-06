import { type NextRequest, NextResponse } from "next/server";
import {
	generateEmbedding,
	listEmbeddingModels,
	prepareBookText,
} from "@/lib/embedding-service";
import { serverSupabase } from "@/lib/serverSupabase";

/**
 * GET /api/admin/embedding/models
 * List available embedding models from omniroute
 */
export async function GET(request: NextRequest) {
	try {
		const models = await listEmbeddingModels();
		return NextResponse.json({ models });
	} catch (error: any) {
		console.error("Error listing embedding models:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to list models" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/embedding/generate
 * Generate embedding for a book
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { title, author, model } = body;

		if (!title || !author) {
			return NextResponse.json(
				{ error: "title and author are required" },
				{ status: 400 },
			);
		}

		const text = prepareBookText(title, author);
		const result = await generateEmbedding(text, { model });

		return NextResponse.json({
			text,
			embedding: result.embedding,
			model: result.model,
			dimensions: result.embedding.length,
			usage: result.usage,
		});
	} catch (error: any) {
		console.error("Error generating embedding:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to generate embedding" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/admin/embedding/embed-all
 * Embed all books that don't have embeddings yet
 */
export async function PUT(request: NextRequest) {
	try {
		const body = await request.json();
		const { model, batchSize = 50 } = body;

		// Get books without embeddings
		const { data: books, error: fetchError } = await serverSupabase
			.from("books")
			.select("id, title, author")
			.is("embedding", null)
			.not("title", "is", null)
			.not("author", "is", null)
			.limit(batchSize);

		if (fetchError) {
			throw new Error(`Failed to fetch books: ${fetchError.message}`);
		}

		if (!books || books.length === 0) {
			return NextResponse.json({
				message: "All books already have embeddings",
				embedded: 0,
			});
		}

		console.log(`Embedding ${books.length} books...`);

		// Generate embeddings
		const { generateEmbeddings, prepareBookText } = await import(
			"@/lib/embedding-service"
		);

		const texts = books.map((b) => prepareBookText(b.title, b.author));
		const results = await generateEmbeddings(texts, { model });

		// Update database
		let embedded = 0;
		for (let i = 0; i < books.length; i++) {
			const book = books[i];
			const result = results[i];

			const { error: updateError } = await serverSupabase
				.from("books")
				.update({
					embedding: `[${result.embedding.join(",")}]`,
					updated_at: new Date().toISOString(),
				})
				.eq("id", book.id);

			if (updateError) {
				console.warn(`Failed to embed "${book.title}":`, updateError.message);
			} else {
				embedded++;
			}
		}

		return NextResponse.json({
			message: `Embedded ${embedded} of ${books.length} books`,
			embedded,
			total: books.length,
			model: results[0]?.model,
		});
	} catch (error: any) {
		console.error("Error batch embedding:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to batch embed" },
			{ status: 500 },
		);
	}
}
