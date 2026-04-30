/**
 * Скрипт для исправления Content-Type существующих обложек в S3
 * Копирует объекты с правильным Content-Type: image/jpeg
 */

import { CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/s3/client";

const coversBucket = process.env.S3_COVERS_BUCKET_NAME;

if (!coversBucket) {
	console.error("❌ S3_COVERS_BUCKET_NAME environment variable is not set");
	process.exit(1);
}

async function fixCoverContentType(key: string): Promise<boolean> {
	const client = getS3Client();

	try {
		// Проверяем текущий Content-Type
		const headCommand = new HeadObjectCommand({
			Bucket: coversBucket,
			Key: key,
		});
		const headResponse = await client.send(headCommand);

		if (headResponse.ContentType === "image/jpeg") {
			console.log(`✓ ${key} - уже имеет правильный Content-Type`);
			return false;
		}

		console.log(
			`🔄 ${key} - текущий Content-Type: ${headResponse.ContentType}, исправляем...`,
		);

		// Копируем объект сам в себя с новым Content-Type
		const copyCommand = new CopyObjectCommand({
			Bucket: coversBucket,
			Key: key,
			CopySource: `${coversBucket}/${key}`,
			ContentType: "image/jpeg",
			MetadataDirective: "REPLACE",
		});

		await client.send(copyCommand);
		console.log(`✅ ${key} - Content-Type исправлен на image/jpeg`);
		return true;
	} catch (error) {
		console.error(`❌ Ошибка при обработке ${key}:`, error);
		return false;
	}
}

async function main() {
	console.log("🚀 Начинаем исправление Content-Type для обложек...\n");

	const { listObjects } = await import("../lib/s3/operations");
	const objects = await listObjects(coversBucket!);

	console.log(`📊 Найдено объектов: ${objects.length}\n`);

	let fixed = 0;
	let skipped = 0;
	let errors = 0;

	for (const obj of objects) {
		const result = await fixCoverContentType(obj.key);
		if (result) {
			fixed++;
		} else if (result === false) {
			skipped++;
		} else {
			errors++;
		}

		// Небольшая задержка между запросами
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	console.log("\n📊 Итоги:");
	console.log(`  ✅ Исправлено: ${fixed}`);
	console.log(`  ✓ Пропущено (уже правильные): ${skipped}`);
	console.log(`  ❌ Ошибок: ${errors}`);
}

main().catch(console.error);
