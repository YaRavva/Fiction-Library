import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import {
	DEFAULT_EMBEDDING_MODEL,
	generateEmbeddings,
} from "@/lib/embedding-service";

interface FileEmbeddingRow {
	message_id: number | string;
	file_name: string;
}

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

export async function POST(request: NextRequest) {
	try {
		const auth = await requireAdminRequest(request);
		if ("error" in auth) return auth.error;

		const body = await request.json();
		const {
			model = DEFAULT_EMBEDDING_MODEL,
			batchSize = 150,
		}: { model?: string; batchSize?: number } = body;
		const admin = auth.admin as SupabaseClient;

		let filesEmbedded = 0;
		let filesTotal = 0;
		let migrationRequired = false;
		const errors: string[] = [];

		// Refresh duplicates first
		const { error: refreshError } = await admin.rpc(
			"refresh_telegram_file_duplicates",
		);
		if (refreshError) {
			console.warn("Failed to refresh Telegram file duplicates:", refreshError);
		}

		// Fetch files without embeddings
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
			} else {
				throw new Error(`Failed to fetch files: ${error.message}`);
			}
		}

		const files = (data || []) as FileEmbeddingRow[];
		filesTotal = files?.length || 0;

		if (files && files.length > 0) {
			// Process in batches of 20 (API limit)
			const apiBatchSize = 20;
			for (let i = 0; i < files.length; i += apiBatchSize) {
				const batch = files.slice(i, i + apiBatchSize);
				const texts = batch.map((file) =>
					normalizeFileNameForEmbedding(file.file_name),
				);

				try {
					const results = await generateEmbeddings(texts, { model });

					for (let j = 0; j < batch.length; j++) {
						const result = results[j];
						const { error: updateError } = await admin
							.from("telegram_files")
							.update({
								embedding: `[${result.embedding.join(",")}]`,
							})
							.eq("message_id", batch[j].message_id);

						if (!updateError) {
							filesEmbedded++;
						} else {
							errors.push(
								`Failed to update ${batch[j].file_name}: ${updateError.message}`,
							);
						}
					}
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					errors.push(`Batch embedding failed: ${errorMsg}`);
					// Continue with next batch
				}
			}
		}

		return NextResponse.json({
			success: errors.length === 0,
			message: migrationRequired
				? `Processed ${filesEmbedded}/${filesTotal} files. Нужна pgvector миграция.`
				: `Processed ${filesEmbedded}/${filesTotal} files`,
			files: { embedded: filesEmbedded, total: filesTotal },
			migrationRequired,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error: unknown) {
		console.error("Error generating file embeddings:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to generate embeddings",
			},
			{ status: 500 },
		);
	}
}
