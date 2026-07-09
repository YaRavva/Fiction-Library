import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import {
	DEFAULT_EMBEDDING_MODEL,
	generateEmbeddings,
	listEmbeddingModels,
	prepareBookText,
} from "@/lib/embedding-service";

type EmbedTarget = "books" | "files" | "all";
type BookEmbeddingRow = { id: string; title: string; author: string };
type FileEmbeddingRow = { message_id: number | string; file_name: string };

function isMissingColumnError(
	error: { message?: string; code?: string } | null,
) {
	return (
		error?.code === "42703" ||
		(error?.message?.toLowerCase().includes("column") &&
			error.message.toLowerCase().includes("embedding") &&
			error.message.toLowerCase().includes("does not exist"))
	);
}

function normalizeFileNameForEmbedding(fileName: string): string {
	return fileName
		.normalize("NFC")
		.replace(/\.[^/.]+$/, "")
		.replace(/[_-]/g, " ")
		.toLowerCase()
		.trim();
}

export async function GET(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const models = await listEmbeddingModels();
		return NextResponse.json({
			models,
			defaultModel: DEFAULT_EMBEDDING_MODEL,
		});
	} catch (error: unknown) {
		console.error("Error listing embedding models:", error);
		return NextResponse.json(
			{ error: (error as Error).message || "Failed to list models" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const body = await request.json();
		const { title, author, model = DEFAULT_EMBEDDING_MODEL } = body;

		if (!title || !author) {
			return NextResponse.json(
				{ error: "title and author are required" },
				{ status: 400 },
			);
		}

		const text = prepareBookText(title, author);
		const [result] = await generateEmbeddings([text], { model });

		return NextResponse.json({
			text,
			embedding: result.embedding,
			model: result.model,
			dimensions: result.embedding.length,
			usage: result.usage,
		});
	} catch (error: unknown) {
		console.error("Error generating embedding:", error);
		return NextResponse.json(
			{ error: (error as Error).message || "Failed to generate embedding" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const body = await request.json();
		const {
			model = DEFAULT_EMBEDDING_MODEL,
			batchSize = 100,
			target = "all",
		}: { model?: string; batchSize?: number; target?: EmbedTarget } = body;
		const admin = auth.admin as any;

		let booksEmbedded = 0;
		let filesEmbedded = 0;
		let booksTotal = 0;
		let filesTotal = 0;
		const skippedTargets: EmbedTarget[] = [];
		let migrationRequired = false;
		let dedupeResult: unknown = null;

		if (target === "books" || target === "all") {
			const { data, error } = await admin
				.from("books")
				.select("id, title, author")
				.is("embedding", null)
				.not("title", "is", null)
				.not("author", "is", null)
				.limit(batchSize);

			if (error) {
				if (isMissingColumnError(error)) {
					migrationRequired = true;
					skippedTargets.push("books");
				} else {
					throw new Error(`Failed to fetch books: ${error.message}`);
				}
			}

			const books = (data || []) as BookEmbeddingRow[];
			booksTotal = books?.length || 0;
			if (books && books.length > 0) {
				const texts = books.map((book) =>
					prepareBookText(book.title, book.author),
				);
				const results = await generateEmbeddings(texts, { model });

				for (let i = 0; i < books.length; i++) {
					const result = results[i];
					const { error: updateError } = await admin
						.from("books")
						.update({
							embedding: `[${result.embedding.join(",")}]`,
							updated_at: new Date().toISOString(),
						})
						.eq("id", books[i].id);

					if (!updateError) booksEmbedded++;
				}
			}
		}

		if (target === "files" || target === "all") {
			const { data: refreshData, error: refreshError } = await admin.rpc(
				"refresh_telegram_file_duplicates",
			);
			if (refreshError) {
				console.warn(
					"Failed to refresh Telegram file duplicates:",
					refreshError,
				);
			} else {
				dedupeResult = refreshData;
			}

			const { data, error } = await admin
				.from("telegram_files")
				.select("message_id, file_name")
				.is("embedding", null)
				.is("duplicate_of_message_id", null)
				.not("file_name", "is", null)
				.limit(batchSize);

			if (error) {
				if (isMissingColumnError(error)) {
					migrationRequired = true;
					skippedTargets.push("files");
				} else {
					throw new Error(`Failed to fetch files: ${error.message}`);
				}
			}

			const files = (data || []) as FileEmbeddingRow[];
			filesTotal = files?.length || 0;
			if (files && files.length > 0) {
				const texts = files.map((file) =>
					normalizeFileNameForEmbedding(file.file_name),
				);
				const results = await generateEmbeddings(texts, { model });

				for (let i = 0; i < files.length; i++) {
					const result = results[i];
					const { error: updateError } = await admin
						.from("telegram_files")
						.update({
							embedding: `[${result.embedding.join(",")}]`,
						})
						.eq("message_id", files[i].message_id);

					if (!updateError) filesEmbedded++;
				}
			}
		}

		return NextResponse.json({
			message: migrationRequired
				? `Books ${booksEmbedded}/${booksTotal}, files ${filesEmbedded}/${filesTotal}. Нужна pgvector миграция: ${skippedTargets.join(", ")}`
				: `Books ${booksEmbedded}/${booksTotal}, files ${filesEmbedded}/${filesTotal}`,
			model,
			books: { embedded: booksEmbedded, total: booksTotal },
			files: { embedded: filesEmbedded, total: filesTotal },
			migrationRequired,
			skippedTargets,
			dedupeResult,
		});
	} catch (error: unknown) {
		console.error("Error batch embedding:", error);
		return NextResponse.json(
			{ error: (error as Error).message || "Failed to batch embed" },
			{ status: 500 },
		);
	}
}
