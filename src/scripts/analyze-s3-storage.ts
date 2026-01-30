/**
 * Скрипт для поиска осиротевших и дублированных файлов в S3
 *
 * Осиротевшие файлы - файлы в S3, которые не привязаны к записям в БД
 * Дублированные файлы - файлы с одинаковым размером и ETag (потенциальные дубликаты)
 *
 * Запуск: bun run src/scripts/analyze-s3-storage.ts
 */

import dotenv from "dotenv";

dotenv.config();

import { createClient } from "@supabase/supabase-js";
import {
	getBooksBucketName,
	getCoversBucketName,
	listObjects,
	type S3Object,
} from "../lib/s3";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Используем service role key если есть, иначе anon key
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error(
		"❌ Ошибка: отсутствуют переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY",
	);
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AnalysisResult {
	bucketName: string;
	totalFiles: number;
	totalSizeBytes: number;
	referencedFiles: number;
	orphanedFiles: S3Object[];
	orphanedSizeBytes: number;
	potentialDuplicates: { key1: string; key2: string; size: number }[];
}

/**
 * Извлекает ключ файла из полного URL
 */
function extractKeyFromUrl(url: string | null): string | null {
	if (!url) return null;
	// URL формат: https://{bucket}.s3.cloud.ru/{key}
	const match = url.match(/s3\.cloud\.ru\/(.+)$/);
	return match ? match[1] : null;
}

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
			// Если вернулось меньше, чем запрашивали, значит это конец
			if (data.length < step) {
				hasMore = false;
			}
		} else {
			hasMore = false;
		}
	}

	return allRecords;
}

/**
 * Анализирует бакет с книгами
 */
async function analyzeBooksBucket(): Promise<AnalysisResult> {
	const bucketName = getBooksBucketName();
	console.log(`\n📚 Анализ бакета с книгами: ${bucketName}`);

	// Получаем все файлы из S3
	console.log("  Получение списка файлов из S3...");
	const s3Objects = await listObjects(bucketName);
	console.log(`  Найдено ${s3Objects.length} файлов в S3`);

	// Получаем все file_url из БД
	console.log("  Получение ссылок из БД...");

	const { count: totalCount } = await supabase
		.from("books")
		.select("*", { count: "exact", head: true })
		.not("file_url", "is", null);

	const books = await fetchAllRecords("books", "id, file_url", "file_url");

	console.log(
		`  📊 В БД (count): ${totalCount} | 📥 Загружено: ${books.length}`,
	);

	if (totalCount !== books.length) {
		console.warn("  ⚠️  ВНИМАНИЕ: Количество записей не совпадает!");
	}

	// Создаём множество ключей файлов из БД
	const dbKeys = new Set<string>();
	for (const book of books || []) {
		const key = extractKeyFromUrl(book.file_url);
		if (key) {
			dbKeys.add(key);
		}
	}

	// Найдём осиротевшие файлы
	const orphanedFiles: S3Object[] = [];
	let orphanedSizeBytes = 0;

	for (const obj of s3Objects) {
		if (!dbKeys.has(obj.key)) {
			orphanedFiles.push(obj);
			orphanedSizeBytes += obj.size;
		}
	}

	// Ищем потенциальные дубликаты по размеру и ETag
	const potentialDuplicates: { key1: string; key2: string; size: number }[] =
		[];
	const sizeEtagMap = new Map<string, S3Object[]>();

	for (const obj of s3Objects) {
		const key = `${obj.size}-${obj.etag}`;
		const existing = sizeEtagMap.get(key) || [];
		existing.push(obj);
		sizeEtagMap.set(key, existing);
	}

	for (const [, objects] of sizeEtagMap) {
		if (objects.length > 1) {
			// Добавляем пары дубликатов
			for (let i = 0; i < objects.length - 1; i++) {
				potentialDuplicates.push({
					key1: objects[i].key,
					key2: objects[i + 1].key,
					size: objects[i].size,
				});
			}
		}
	}

	const totalSizeBytes = s3Objects.reduce((sum, obj) => sum + obj.size, 0);

	return {
		bucketName,
		totalFiles: s3Objects.length,
		totalSizeBytes,
		referencedFiles: dbKeys.size,
		orphanedFiles,
		orphanedSizeBytes,
		potentialDuplicates,
	};
}

/**
 * Анализирует бакет с обложками
 */
async function analyzeCoversBucket(): Promise<AnalysisResult> {
	const bucketName = getCoversBucketName();
	console.log(`\n🖼️  Анализ бакета с обложками: ${bucketName}`);

	// Получаем все файлы из S3
	console.log("  Получение списка файлов из S3...");
	const s3Objects = await listObjects(bucketName);
	console.log(`  Найдено ${s3Objects.length} файлов в S3`);

	// Получаем все cover_url из БД
	console.log("  Получение ссылок из БД...");

	const { count: totalCount } = await supabase
		.from("books")
		.select("*", { count: "exact", head: true })
		.not("cover_url", "is", null);

	const books = await fetchAllRecords("books", "id, cover_url", "cover_url");

	console.log(
		`  📊 В БД (count): ${totalCount} | 📥 Загружено: ${books.length}`,
	);

	if (totalCount !== books.length) {
		console.warn("  ⚠️  ВНИМАНИЕ: Количество записей не совпадает!");
	}

	// Создаём множество ключей файлов из БД
	const dbKeys = new Set<string>();
	for (const book of books || []) {
		const key = extractKeyFromUrl(book.cover_url);
		if (key) {
			dbKeys.add(key);
		}
	}

	// Найдём осиротевшие файлы
	const orphanedFiles: S3Object[] = [];
	let orphanedSizeBytes = 0;

	for (const obj of s3Objects) {
		if (!dbKeys.has(obj.key)) {
			orphanedFiles.push(obj);
			orphanedSizeBytes += obj.size;
		}
	}

	// Ищем потенциальные дубликаты по размеру и ETag
	const potentialDuplicates: { key1: string; key2: string; size: number }[] =
		[];
	const sizeEtagMap = new Map<string, S3Object[]>();

	for (const obj of s3Objects) {
		const key = `${obj.size}-${obj.etag}`;
		const existing = sizeEtagMap.get(key) || [];
		existing.push(obj);
		sizeEtagMap.set(key, existing);
	}

	for (const [, objects] of sizeEtagMap) {
		if (objects.length > 1) {
			for (let i = 0; i < objects.length - 1; i++) {
				potentialDuplicates.push({
					key1: objects[i].key,
					key2: objects[i + 1].key,
					size: objects[i].size,
				});
			}
		}
	}

	const totalSizeBytes = s3Objects.reduce((sum, obj) => sum + obj.size, 0);

	return {
		bucketName,
		totalFiles: s3Objects.length,
		totalSizeBytes,
		referencedFiles: dbKeys.size,
		orphanedFiles,
		orphanedSizeBytes,
		potentialDuplicates,
	};
}

/**
 * Форматирует размер в читаемый формат
 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Выводит результаты анализа
 */
function printResults(result: AnalysisResult): void {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`📊 Результаты анализа: ${result.bucketName}`);
	console.log(`${"=".repeat(60)}`);

	console.log(`\n📁 Общая статистика:`);
	console.log(`   Всего файлов в S3: ${result.totalFiles}`);
	console.log(`   Общий размер: ${formatSize(result.totalSizeBytes)}`);
	console.log(`   Файлов привязано к БД: ${result.referencedFiles}`);

	console.log(`\n🗑️  Осиротевшие файлы (не привязаны к БД):`);
	console.log(`   Количество: ${result.orphanedFiles.length}`);
	console.log(`   Занимают: ${formatSize(result.orphanedSizeBytes)}`);

	if (result.orphanedFiles.length > 0) {
		console.log(`\n   Первые 20 осиротевших файлов:`);
		for (const obj of result.orphanedFiles.slice(0, 20)) {
			console.log(`   - ${obj.key} (${formatSize(obj.size)})`);
		}
		if (result.orphanedFiles.length > 20) {
			console.log(`   ... и ещё ${result.orphanedFiles.length - 20} файлов`);
		}
	}

	console.log(`\n🔄 Потенциальные дубликаты (одинаковый размер и ETag):`);
	console.log(`   Количество пар: ${result.potentialDuplicates.length}`);

	if (result.potentialDuplicates.length > 0) {
		console.log(`\n   Первые 10 пар дубликатов:`);
		for (const dup of result.potentialDuplicates.slice(0, 10)) {
			console.log(`   - ${dup.key1}`);
			console.log(`     ${dup.key2} (${formatSize(dup.size)})`);
		}
		if (result.potentialDuplicates.length > 10) {
			console.log(`   ... и ещё ${result.potentialDuplicates.length - 10} пар`);
		}
	}
}

async function main() {
	console.log("🚀 Запуск анализа S3 хранилища");
	console.log(`   Supabase URL: ${supabaseUrl}`);

	try {
		// Анализируем бакет с книгами
		const booksResult = await analyzeBooksBucket();
		printResults(booksResult);

		// Анализируем бакет с обложками
		const coversResult = await analyzeCoversBucket();
		printResults(coversResult);

		// Итоговая сводка
		console.log(`\n${"=".repeat(60)}`);
		console.log("📊 ИТОГОВАЯ СВОДКА");
		console.log(`${"=".repeat(60)}`);

		const totalOrphaned =
			booksResult.orphanedFiles.length + coversResult.orphanedFiles.length;
		const totalOrphanedSize =
			booksResult.orphanedSizeBytes + coversResult.orphanedSizeBytes;
		const totalDuplicates =
			booksResult.potentialDuplicates.length +
			coversResult.potentialDuplicates.length;

		console.log(`\n🗑️  Всего осиротевших файлов: ${totalOrphaned}`);
		console.log(`   Можно освободить: ${formatSize(totalOrphanedSize)}`);
		console.log(`\n🔄 Всего потенциальных дубликатов: ${totalDuplicates}`);

		if (totalOrphaned > 0) {
			console.log(
				"\n💡 Для удаления осиротевших файлов создайте скрипт очистки",
			);
		}

		console.log("\n✅ Анализ завершён");
	} catch (error) {
		console.error("\n❌ Ошибка при анализе:", error);
		process.exit(1);
	}
}

main();
