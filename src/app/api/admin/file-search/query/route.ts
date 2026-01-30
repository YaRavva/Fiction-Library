import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { UniversalFileMatcher } from "@/lib/universal-file-matcher-enhanced";

// Используем service role key для доступа ко всем данным
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface FileRecord {
	message_id: number;
	file_name: string | null;
	file_size: number | null;
	mime_type: string | null;
	caption: string | null;
	date: string | null;
}

interface BookInfo {
	id: string;
	title: string;
	author: string;
	publication_year?: number;
}

interface FileOption {
	message_id: number;
	file_name: string;
	file_size?: number;
	mime_type: string;
	caption?: string;
	date: number;
	relevance_score?: number;
}

/**
 * GET /api/admin/file-search/query
 * Ищет релевантные файлы для книги, используя UniversalFileMatcher
 *
 * Query params:
 * - author: автор книги (обязательно)
 * - title: название книги (обязательно)
 * - limit: максимальное количество результатов (по умолчанию 15)
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const author = searchParams.get("author");
		const title = searchParams.get("title");
		const limit = parseInt(searchParams.get("limit") || "15", 10);

		if (!author || !title) {
			return NextResponse.json(
				{ error: "Both 'author' and 'title' query parameters are required" },
				{ status: 400 },
			);
		}

		console.log(`🔍 Поиск файлов для книги: "${author}" - "${title}"`);

		// 1. Загружаем все файлы из БД
		const { data: allFiles, error } = await supabaseAdmin
			.from("telegram_files")
			.select("message_id, file_name, file_size, mime_type, caption, date")
			.not("file_name", "is", null);

		if (error) {
			throw new Error(`Database error: ${error.message}`);
		}

		if (!allFiles || allFiles.length === 0) {
			console.log(
				"⚠️ Индекс файлов пуст. Запустите индексацию: POST /api/admin/telegram-files/index",
			);
			return NextResponse.json({
				files: [],
				total: 0,
				message: "Индекс файлов пуст. Запустите индексацию.",
			});
		}

		console.log(`📂 Загружено ${allFiles.length} файлов из индекса`);

		// 2. Подготавливаем данные для UniversalFileMatcher
		const book: BookInfo = {
			id: "search",
			title,
			author,
		};

		const filesForMatcher: FileOption[] = allFiles
			.filter((f: FileRecord) => f.file_name)
			.map((f: FileRecord) => ({
				message_id: f.message_id,
				file_name: f.file_name!,
				file_size: f.file_size || undefined,
				mime_type: f.mime_type || "application/octet-stream",
				caption: f.caption || undefined,
				date: f.date
					? Math.floor(new Date(f.date).getTime() / 1000)
					: Math.floor(Date.now() / 1000),
			}));

		// 3. Используем UniversalFileMatcher для сопоставления
		const matchResults: { file: FileOption; score: number }[] = [];

		for (const file of filesForMatcher) {
			const result = UniversalFileMatcher.matchFileToBook(
				{
					message_id: file.message_id,
					file_name: file.file_name,
					mime_type: file.mime_type,
				},
				book,
			);

			if (result.score >= 50) {
				// Порог релевантности
				matchResults.push({
					file: { ...file, relevance_score: result.score },
					score: result.score,
				});
			}
		}

		// 4. Сортируем по релевантности и берем топ-N
		matchResults.sort((a, b) => b.score - a.score);
		const topFiles = matchResults.slice(0, limit).map((r) => r.file);

		console.log(
			`✅ Найдено ${matchResults.length} релевантных файлов, возвращаем топ-${limit}`,
		);

		return NextResponse.json({
			files: topFiles,
			total: matchResults.length,
		});
	} catch (error) {
		console.error("Error in file search API:", error);
		return NextResponse.json(
			{
				error:
					"Internal server error: " +
					(error instanceof Error ? error.message : String(error)),
			},
			{ status: 500 },
		);
	}
}
