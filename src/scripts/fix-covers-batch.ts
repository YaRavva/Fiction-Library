/**
 * Оптимизированный скрипт для исправления Content-Type обложек
 * Обрабатывает только файлы с неправильным Content-Type
 */

import { CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/s3/client";
import { listObjects } from "../lib/s3/operations";

const coversBucket = process.env.S3_COVERS_BUCKET_NAME;

if (!coversBucket) {
	console.error("❌ S3_COVERS_BUCKET_NAME environment variable is not set");
	process.exit(1);
}

async function fixCover(key: string): Promise<boolean> {
	const client = getS3Client();

	try {
		// Проверяем текущий Content-Type
		const headCommand = new HeadObjectCommand({
			Bucket: coversBucket,
			Key: key,
		});
		const headResponse = await client.send(headCommand);

		if (headResponse.ContentType === "image/jpeg") {
			return false; // Уже правильный
		}

		// Копируем с новым Content-Type
		const copyCommand = new CopyObjectCommand({
			Bucket: coversBucket,
			Key: key,
			CopySource: `${coversBucket}/${key}`,
			ContentType: "image/jpeg",
			MetadataDirective: "REPLACE",
		});

		await client.send(copyCommand);
		return true; // Исправлено
	} catch (error) {
		console.error(`❌ ${key}:`, error);
		return false;
	}
}

async function main() {
	console.log("🚀 Начинаем исправление Content-Type для обложек...\n");

	const objects = await listObjects(coversBucket!);
	console.log(`📊 Всего файлов: ${objects.length}\n`);

	let fixed = 0;
	let skipped = 0;
	let processed = 0;

	// Обрабатываем пакетами по 10 файлов параллельно
	const batchSize = 10;
	for (let i = 0; i < objects.length; i += batchSize) {
		const batch = objects.slice(i, i + batchSize);
		const results = await Promise.all(
			batch.map(async (obj) => {
				const result = await fixCover(obj.key);
				processed++;
				if (processed % 50 === 0) {
					console.log(`⏳ Обработано: ${processed}/${objects.length}`);
				}
				return result;
			}),
		);

		fixed += results.filter((r) => r === true).length;
		skipped += results.filter((r) => r === false).length;
	}

	console.log("\n📊 Итоги:");
	console.log(`  ✅ Исправлено: ${fixed}`);
	console.log(`  ✓ Пропущено (уже правильные): ${skipped}`);
	console.log(`  📝 Всего обработано: ${processed}`);
}

main().catch(console.error);
