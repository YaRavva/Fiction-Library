"use client";

import type { Session } from "@supabase/supabase-js";
import { BookOpen, Library, Menu, X } from "lucide-react";
import Head from "next/head";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BookCardLarge } from "@/components/books/book-card-large";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import type { Book as SupabaseBook } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Расширяем тип Book из supabase дополнительными полями
interface Book extends SupabaseBook {
	series?: {
		id: string;
		title: string;
		author: string;
		series_composition?: { title: string; year: number }[];
		cover_urls?: string[];
	};
}

interface UserProfile {
	id: string;
	username?: string;
	display_name?: string;
	role: string;
}

function BookContent() {
	const [supabase] = useState(() => getBrowserSupabase());
	const router = useRouter();
	const searchParams = useSearchParams();
	const bookId = searchParams.get("id");
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		const initSession = async () => {
			try {
				const { user: authUser } = await getValidSession(supabase);
				setUser(authUser);

				if (authUser) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.single();

					if (profile) {
						setUserProfile(profile);
					}
				}
			} catch (error) {
				console.error("Error initializing session:", error);
			}
		};

		initSession();
	}, [supabase]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/auth/login");
	};

	useEffect(() => {
		const loadBook = async () => {
			if (!bookId) {
				router.push("/library");
				return;
			}

			try {
				const { data, error } = await supabase
					.from("books")
					.select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
					.eq("id", bookId)
					.single();

				if (error) {
					console.error("Error loading book:", error);
					router.push("/library");
				} else {
					setBook(data);
				}
			} catch (error) {
				console.error("Error loading book:", error);
				router.push("/library");
			} finally {
				setLoading(false);
			}
		};

		loadBook();
	}, [bookId, router, supabase]);

	// Функция для парсинга имени файла из заголовка Content-Disposition
	const parseContentDisposition = (
		contentDisposition: string | null,
	): string | null => {
		if (!contentDisposition) return null;

		// Сначала пытаемся извлечь из filename* (RFC 5987) - приоритет
		const filenameStarMatch = contentDisposition.match(/filename\*=([^;]+)/i);
		if (filenameStarMatch) {
			const value = filenameStarMatch[1].trim();
			// Формат: UTF-8''encoded-filename
			const parts = value.split("''");
			if (parts.length === 2) {
				try {
					return decodeURIComponent(parts[1]);
				} catch (e) {
					console.warn("Failed to decode filename*:", e);
				}
			}
		}

		// Затем пытаемся извлечь из filename (обычный формат)
		const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
		if (filenameMatch) {
			let value = filenameMatch[1].trim();
			// Убираем кавычки если есть
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			try {
				return decodeURIComponent(value);
			} catch (_e) {
				return value;
			}
		}

		return null;
	};

	const handleDownload = async (book: Book) => {
		if (book.file_url) {
			try {
				// Используем API endpoint для скачивания, который правильно переименовывает файл
				const response = await fetch(`/api/download/${book.id}`);

				if (!response.ok) {
					throw new Error(`Failed to download: ${response.statusText}`);
				}

				// Получаем имя файла из заголовка Content-Disposition
				const contentDisposition = response.headers.get("Content-Disposition");
				let filename = parseContentDisposition(contentDisposition);

				// Если не удалось извлечь из заголовка, используем fallback
				if (!filename) {
					filename = `${book.id}.${book.file_format || "zip"}`;
					console.warn(
						"Could not parse filename from Content-Disposition, using fallback:",
						filename,
					);
				}

				console.log("Downloading file with filename:", filename);

				// Скачиваем файл с правильным именем
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);

				// Увеличиваем счетчик скачиваний (API endpoint уже делает это, но на всякий случай)
				await incrementDownloads(book.id);
			} catch (error) {
				console.error("Error downloading file:", error);
				// Fallback: открываем файл в новой вкладке
				if (book.file_url) {
					window.open(book.file_url, "_blank");
				}
			}
		}
	};

	const handleRead = (book: Book) => {
		if (book.file_url) {
			// Увеличиваем счетчик просмотров
			incrementViews(book.id);
			// Переходим к читалке
			router.push(`/reader?bookId=${book.id}`);
		}
	};

	const incrementViews = async (bookId: string) => {
		try {
			await supabase.rpc("increment_views", { book_id: bookId });
			// Обновляем локальное состояние
			if (book && book.id === bookId) {
				setBook({ ...book, views_count: book.views_count + 1 });
			}
		} catch (error) {
			console.error("Error incrementing views:", error);
		}
	};

	const incrementDownloads = async (bookId: string) => {
		try {
			await supabase.rpc("increment_downloads", { book_id: bookId });
			// Обновляем локальное состояние
			if (book && book.id === bookId) {
				setBook({ ...book, downloads_count: book.downloads_count + 1 });
			}
		} catch (error) {
			console.error("Error incrementing downloads:", error);
		}
	};

	// Добавляем функцию для очистки привязки файла
	const handleClearFile = async (bookId: string) => {
		try {
			// Очищаем привязку файла к книге
			const { error } = await supabase
				.from("books")
				.update({
					file_url: null,
					file_size: null,
					file_format: null,
					telegram_file_id: null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", bookId);

			if (error) {
				console.error("❌ Ошибка при очистке файла:", error);
				alert("Ошибка при очистке файла");
			} else {
				// Обновляем локальное состояние
				if (book && book.id === bookId) {
					setBook({
						...book,
						file_url: undefined,
						file_size: undefined,
						file_format: "",
						telegram_file_id: undefined,
					} as unknown as Book);
				}
				alert("Файл успешно очищен!");
			}
		} catch (error) {
			console.error("❌ Ошибка:", error);
			alert("Произошла ошибка при очистке файла");
		}
	};

	// Создаем новую функцию для обработки клика по тегу
	const handleTagClick = (tag: string) => {
		// Переходим к библиотеке с поисковым запросом по тегу
		router.push(`/library?search=#${tag}`);
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center space-y-4">
					<p className="text-muted-foreground">Загрузка книги...</p>
				</div>
			</div>
		);
	}

	if (!book) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center space-y-4">
					<p className="text-muted-foreground">Книга не найдена</p>
				</div>
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-screen bg-background overflow-hidden">
				{/* Desktop Sidebar */}
				<AppSidebar
					user={user}
					userProfile={userProfile}
					onLogout={handleLogout}
				/>

				<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
					{/* Mobile Header */}
					<header className="lg:hidden flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-xl sticky top-0 z-30">
						<div className="flex items-center gap-2">
							<Library className="h-6 w-6 text-primary" />
							<span className="font-bold text-lg">FictionLib</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setMobileMenuOpen(true)}
						>
							<Menu className="h-6 w-6" />
						</Button>
					</header>

					{/* Mobile Menu Overlay */}
					{mobileMenuOpen && (
						<div className="fixed inset-0 z-50 lg:hidden bg-background/80 backdrop-blur-sm">
							<div className="fixed inset-y-0 left-0 w-72 bg-card border-r shadow-2xl p-0 flex flex-col">
								<div className="flex items-center justify-end p-4">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setMobileMenuOpen(false)}
									>
										<X className="h-6 w-6" />
									</Button>
								</div>
								<div className="flex-1 overflow-y-auto">
									<AppSidebar
										user={user}
										userProfile={userProfile}
										onLogout={handleLogout}
									/>
								</div>
							</div>
							<div
								className="flex-1"
								onClick={() => setMobileMenuOpen(false)}
							/>
						</div>
					)}

					<main className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
						<Head>
							<title>
								{book.author} - {book.title} | Fiction Library
							</title>
						</Head>

						<div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
							<BookCardLarge
								book={book}
								onDownload={handleDownload}
								onRead={handleRead}
								onTagClick={handleTagClick}
								onFileClear={handleClearFile}
								userProfile={userProfile}
							/>

							<div className="flex justify-center mt-8">
								<Button
									onClick={() => router.push("/library")}
									variant="outline"
									className="hover:bg-primary/10 transition-colors"
								>
									Вернуться в библиотеку
								</Button>
							</div>
						</div>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}

export default function BookPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center space-y-4">
						<BookOpen className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
						<p className="text-muted-foreground">Загрузка книги...</p>
					</div>
				</div>
			}
		>
			<BookContent />
		</Suspense>
	);
}
