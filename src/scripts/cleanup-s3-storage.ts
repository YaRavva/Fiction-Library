/**
 * Скрипт для очистки осиротевших файлов в S3
 *
 * Удаляет файлы, которые не привязаны к записям в БД.
 *
 * Использование:
 *   bun run src/scripts/cleanup-s3-storage.ts [--dry-run] [--force]
 *
 * Опции:
 *   --dry-run (по умолчанию) - только показать, что будет удалено
 *   --force - реально удалить файлы
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
	deleteObject,
	getBooksBucketName,
	getCoversBucketName,
	listObjects,
	type S3Object,
} from "../lib/s3";

dotenv.config();

// Парсинг аргументов
const args = process.argv.slice(2);
const isDryRun = !args.includes("--force");

console.log(
	isDryRun
		? "🔍 РЕЖИМ DRY-RUN (Без удаления)"
		: "⚠️  РЕЖИМ УДАЛЕНИЯ (Файлы будут уничтожены)",
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error("❌ Ошибка: отсутствуют переменные окружения Supabase");
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Получает все записи из таблицы с пагинацией
 */
async function fetchAllRecords(
	table: string,
	select: string,
	column: string,
): Promise<any[]> {
	let allRecords: any[] = [];
	let from = 0;
	const step = 1000;
	let hasMore = true;

	while (hasMore) {
		const { data, error } = await supabase
			.from(table)
			.select(select)
			.not(column, "is", null)
			.range(from, from + step - 1);

		if (error) {
			throw new Error(`Ошибка при получении данных: ${error.message}`);
		}

		if (data && data.length > 0) {
			allRecords = allRecords.concat(data);
			from += step;
			if (data.length < step) hasMore = false;
		} else {
			hasMore = false;
		}
	}
	return allRecords;
}

function extractKeyFromUrl(url: string | null): string | null {
	if (!url) return null;
	const match = url.match(/s3\.cloud\.ru\/(.+)$/);
	return match ? match[1] : null;
}

async function cleanupBucket(
	bucketName: string,
	tableName: string,
	urlColumn: string,
) {
	console.log(`\n🧹 Очистка бакета: ${bucketName}`);

	// 1. Получаем файлы из S3
	console.log("  Получение списка файлов из S3...");
	const s3Objects = await listObjects(bucketName);
	console.log(`  Найдено ${s3Objects.length} файлов в S3`);

	// 2. Получаем ссылки из БД
	console.log("  Получение ссылок из БД...");

	const { count: totalCount } = await supabase
		.from(tableName)
		.select("*", { count: "exact", head: true })
		.not(urlColumn, "is", null);

	const records = await fetchAllRecords(tableName, urlColumn, urlColumn);

	console.log(
		`  📊 В БД (count): ${totalCount} | 📥 Загружено: ${records.length}`,
	);

	if (totalCount !== records.length) {
		console.warn("  ⚠️  ВНИМАНИЕ: Количество записей не совпадает!");
	}

	const dbKeys = new Set<string>();
	for (const record of records) {
		const key = extractKeyFromUrl(record[urlColumn]);
		if (key) dbKeys.add(key);
	}

	// 3. Ищем осиротевшие
	const orphanedFiles: S3Object[] = [];
	for (const obj of s3Objects) {
		if (!dbKeys.has(obj.key)) {
			orphanedFiles.push(obj);
		}
	}

	console.log(`  🔍 Найдено ${orphanedFiles.length} осиротевших файлов`);

	if (orphanedFiles.length === 0) {
		console.log("  ✅ Бакет чист");
		return;
	}

	// 4. Сохраняем отчет
	const logDir = path.join(process.cwd(), "logs");
	if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
	const logFile = path.join(
		logDir,
		`cleanup-${bucketName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
	);

	fs.writeFileSync(
		logFile,
		JSON.stringify(
			orphanedFiles.map((f) => f.key),
			null,
			2,
		),
	);
	console.log(`  📄 Список файлов сохранен в: ${logFile}`);

	// 5. Удаление
	if (isDryRun) {
		console.log("  info: Запустите с флагом --force для реального удаления");
	} else {
		console.log("  🗑️  Начинаю удаление...");
		let deletedCount = 0;
		for (const file of orphanedFiles) {
			try {
				await deleteObject(file.key, bucketName);
				deletedCount++;
				if (deletedCount % 50 === 0) {
					console.log(`    Удалено ${deletedCount}/${orphanedFiles.length}...`);
				}
			} catch (err) {
				console.error(`    Ошибка удаления ${file.key}:`, err);
			}
		}
		console.log(`  ✅ Удалено ${deletedCount} файлов`);
	}
}

async function main() {
	try {
		await cleanupBucket(getBooksBucketName(), "books", "file_url");
		await cleanupBucket(getCoversBucketName(), "books", "cover_url");
		console.log("\n✅ Завершено");
	} catch (error) {
		console.error("\n❌ Ошибка:", error);
		process.exit(1);
	}
}

main();
