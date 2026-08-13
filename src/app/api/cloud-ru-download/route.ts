import { type NextRequest, NextResponse } from "next/server";
import { getDownloadUrlForReference } from "@/lib/s3";

const BUCKET = process.env.S3_BUCKET_NAME || "books";
const DEFAULT_EXPIRY = 3600;

function parseExpiry(value: unknown): number {
	const parsed = Number(value ?? DEFAULT_EXPIRY);
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 604800) {
		throw new Error("expiresIn must be an integer between 1 and 604800");
	}
	return parsed;
}

async function createDownloadResponse(
	fileName: unknown,
	expiresInValue: unknown,
) {
	if (typeof fileName !== "string" || !fileName.trim()) {
		return NextResponse.json(
			{ error: "Missing required parameter: fileName" },
			{ status: 400 },
		);
	}

	try {
		const expiresIn = parseExpiry(expiresInValue);
		const url = await getDownloadUrlForReference(fileName, BUCKET, expiresIn);

		return NextResponse.json({
			url,
			expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
			fileName,
			bucket: BUCKET,
		});
	} catch (error) {
		console.error("Error generating Cloud.ru S3 download URL:", error);
		return NextResponse.json(
			{ error: "Failed to generate download URL" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/cloud-ru-download?fileName=2806.zip&expiresIn=3600
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	return createDownloadResponse(
		searchParams.get("fileName"),
		searchParams.get("expiresIn"),
	);
}

/**
 * POST /api/cloud-ru-download
 * Body: { "fileName": "2806.zip", "expiresIn": 3600 }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		return createDownloadResponse(body?.fileName, body?.expiresIn);
	} catch (error) {
		console.error("Error parsing Cloud.ru download request:", error);
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}
}
