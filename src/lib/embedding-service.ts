/**
 * Omniroute Embedding Service
 * Uses OpenAI-compatible API for generating text embeddings
 */

const OMNIROUTE_BASE_URL =
	process.env.OMNIROUTE_BASE_URL || "http://omniroute.ravva.su:20128";
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || "";
const DEFAULT_EMBEDDING_MODEL = "voyage-ai/voyage-4";

function getOmnirouteApiBaseUrl(): string {
	const baseUrl = OMNIROUTE_BASE_URL.trim().replace(/\/+$/, "");
	return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function getOmnirouteUrl(path: string): string {
	return `${getOmnirouteApiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

export interface EmbeddingOptions {
	model?: string;
	dimensions?: number;
}

export interface EmbeddingResult {
	embedding: number[];
	model: string;
	usage: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

export interface ModelInfo {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

/**
 * Get list of available embedding models from omniroute
 */
export async function listEmbeddingModels(): Promise<ModelInfo[]> {
	if (!OMNIROUTE_API_KEY) {
		throw new Error("OMNIROUTE_API_KEY not configured");
	}

	const response = await fetch(getOmnirouteUrl("models"), {
		headers: {
			Authorization: `Bearer ${OMNIROUTE_API_KEY}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.statusText}`);
	}

	const data = await response.json();

	// Filter for embedding models only
	const models = data.data || [];
	return models.filter(
		(m: ModelInfo) =>
			m.id.includes("embed") ||
			m.id.includes("embedding") ||
			m.id.includes("e5") ||
			m.id.includes("bge") ||
			m.id.includes("ada"),
	);
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
	text: string,
	options: EmbeddingOptions = {},
): Promise<EmbeddingResult> {
	if (!OMNIROUTE_API_KEY) {
		throw new Error("OMNIROUTE_API_KEY not configured");
	}

	const model = options.model || DEFAULT_EMBEDDING_MODEL;

	const response = await fetch(getOmnirouteUrl("embeddings"), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${OMNIROUTE_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			input: text,
			model: model,
			dimensions: options.dimensions,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Embedding failed: ${response.statusText} - ${error}`);
	}

	const data = await response.json();

	return {
		embedding: data.data[0].embedding,
		model: data.model,
		usage: data.usage,
	};
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(
	texts: string[],
	options: EmbeddingOptions = {},
): Promise<EmbeddingResult[]> {
	if (!OMNIROUTE_API_KEY) {
		throw new Error("OMNIROUTE_API_KEY not configured");
	}

	const model = options.model || DEFAULT_EMBEDDING_MODEL;

	// Process in batches of 20 (API limit)
	const batchSize = 20;
	const results: EmbeddingResult[] = [];

	for (let i = 0; i < texts.length; i += batchSize) {
		const batch = texts.slice(i, i + batchSize);

		const response = await fetch(getOmnirouteUrl("embeddings"), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${OMNIROUTE_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				input: batch,
				model: model,
				dimensions: options.dimensions,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`Batch embedding failed: ${response.statusText} - ${error}`,
			);
		}

		const data = await response.json();

		// Sort by index to maintain order
		const sorted = data.data.sort((a: any, b: any) => a.index - b.index);

		for (const item of sorted) {
			results.push({
				embedding: item.embedding,
				model: data.model,
				usage: {
					prompt_tokens: Math.ceil(data.usage.prompt_tokens / batch.length),
					total_tokens: Math.ceil(data.usage.total_tokens / batch.length),
				},
			});
		}
	}

	return results;
}

/**
 * Prepare text for embedding (combine title + author)
 */
export function prepareBookText(title: string, author: string): string {
	// Normalize text
	const normalizedTitle = title.toLowerCase().trim();
	const normalizedAuthor = author.toLowerCase().trim();

	// Combine with separator
	return `${normalizedTitle} by ${normalizedAuthor}`;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error("Vectors must have same length");
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
	listEmbeddingModels,
	generateEmbedding,
	generateEmbeddings,
	prepareBookText,
	cosineSimilarity,
};
