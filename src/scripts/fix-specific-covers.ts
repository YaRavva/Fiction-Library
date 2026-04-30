/**
 * Быстрое исправление Content-Type для конкретных обложек
 */

import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/s3/client";

const coversBucket = process.env.S3_COVERS_BUCKET_NAME;

if (!coversBucket) {
	console.error("❌ S3_COVERS_BUCKET_NAME environment variable is not set");
	process.exit(1);
}

const problematicFiles = [
	"964_1760896074410.jpg",
	"1015_1760896057854.jpg",
	"1002_1760896049473.jpg",
	"1179_1760898387635.jpg",
	"1169_1760895966939.jpg",
];

async function fixCover(key: string): Promise<void> {
	const client = getS3Client();

	try {
		console.log(`🔄 Исправляем ${key}...`);

		const copyCommand = new CopyObjectCommand({
			Bucket: coversBucket,
			Key: key,
			CopySource: `${coversBucket}/${key}`,
			ContentType: "image/jpeg",
			MetadataDirective: "REPLACE",
		});

		await client.send(copyCommand);
		console.log(`✅ ${key} - Content-Type исправлен`);
	} catch (error) {
		console.error(`❌ Ошибка при обработке ${key}:`, error);
	}
}

async function main() {
	console.log("🚀 Исправляем Content-Type для проблемных обложек...\n");

	for (const file of problematicFiles) {
		await fixCover(file);
	}

	console.log("\n✅ Готово!");
}

main().catch(console.error);
