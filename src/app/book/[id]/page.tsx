"use client";

import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Library } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BookCardLarge } from "@/components/books/book-card-large";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import type { Book as SupabaseBook } from "@/lib/supabase";

// Extended Book type
interface Book extends SupabaseBook {
	rating?: number;
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

function BookDetailPageContent() {
	const params = useParams();
	const bookId = params?.id as string;
	const [supabase] = useState(() => getBrowserSupabase());
	const router = useRouter();
	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [isLiked, setIsLiked] = useState(false);

	useEffect(() => {
		const loadBook = async () => {
			if (!bookId) return;

			setLoading(true);
			try {
				// 1. Session & Profile
				const session = await getValidSession(supabase);
				const authUser = session?.user;
				setUser(authUser || null);

				if (authUser) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.maybeSingle();

					if (profile) {
						setUserProfile(profile as UserProfile);
					}

					// Check like status
					const { data: likeData } = await supabase
						.from("user_favorites")
						.select("id")
						.eq("user_id", authUser.id)
						.eq("book_id", bookId)
						.maybeSingle();
					setIsLiked(!!likeData);
				}

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
				} else {
					setBook(data as Book);
				}
			} catch (error) {
				console.error("Error loading book data:", error);
			} finally {
				setLoading(false);
			}
		};

		loadBook();
	}, [supabase, bookId]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	const handleLikeToggle = async () => {
		if (!user || !book) return;

		if (isLiked) {
			const { error } = await supabase
				.from("user_favorites")
				.delete()
				.match({ user_id: user.id, book_id: book.id });
			if (!error) setIsLiked(false);
		} else {
			const { error } = await supabase
				.from("user_favorites")
				.insert({ user_id: user.id, book_id: book.id });
			if (!error) setIsLiked(true);
		}
	};

	const incrementDownloads = async (id: string) => {
		try {
			await supabase.rpc("increment_downloads", { book_id: id });
			if (book) {
				setBook({ ...book, downloads_count: (book.downloads_count || 0) + 1 });
			}
		} catch (error) {
			console.error("Error incrementing downloads:", error);
		}
	};

	const handleDownload = (book: Book) => {
		if (book.file_url) {
			incrementDownloads(book.id);
			window.location.href = `/api/download/${book.id}`;
		}
	};

	const incrementViews = async (id: string) => {
		try {
			await supabase.rpc("increment_views", { book_id: id });
			if (book) {
				setBook({ ...book, views_count: (book.views_count || 0) + 1 });
			}
		} catch (error) {
			console.error("Error incrementing views:", error);
		}
	};

	const handleRead = (book: Book) => {
		if (book.file_url) {
			incrementViews(book.id);
			router.push(`/reader?bookId=${book.id}`);
		}
	};

	const handleClearFile = async (id: string) => {
		try {
			const { error } = await supabase
				.from("books")
				.update({
					file_url: null,
					file_size: null,
					file_format: null,
					telegram_file_id: null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", id);

			if (error) {
				console.error("❌ Ошибка при очистке файла:", error);
				alert("Ошибка при очистке файла");
			} else {
				if (book) {
					setBook({
						...book,
						file_url: undefined, // Type compatibility hack, relying on UI to handle undefined
						file_size: undefined as any,
						file_format: undefined,
						telegram_file_id: undefined as any,
					});
				}
				alert("Файл успешно очищен!");
			}
		} catch (error) {
			console.error("❌ Ошибка:", error);
			alert("Произошла ошибка при очистке файла");
		}
	};

	const handleTagClick = (tag: string) => {
		router.push(`/library?search=%23${encodeURIComponent(tag)}`);
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<Library className="h-12 w-12 mx-auto animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка книги...</p>
				</div>
			</div>
		);
	}

	if (!book) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
				<h1 className="text-2xl font-bold mb-4">Книга не найдена</h1>
				<Button onClick={() => router.back()}>Назад</Button>
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-screen bg-background overflow-hidden">
				<AppSidebar
					user={user}
					userProfile={userProfile}
					onLogout={handleLogout}
				/>

				<div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
					<div className="container mx-auto px-4 py-8 max-w-4xl">
						<Button
							variant="ghost"
							className="mb-6 hover:bg-transparent hover:text-primary pl-0"
							onClick={() => router.back()}
						>
							<ArrowLeft className="h-5 w-5 mr-2" />
							Назад в библиотеку
						</Button>

						<BookCardLarge
							book={book}
							onDownload={handleDownload}
							onRead={handleRead}
							userProfile={userProfile}
							onFileClear={
								userProfile?.role === "admin"
									? (id) => handleClearFile(id)
									: undefined
							}
							onTagClick={handleTagClick}
							// onAuthorClick is optional, maybe navigate to library filtered by author?
							onAuthorClick={(author) =>
								router.push(`/library?search=${encodeURIComponent(author)}`)
							}
							isLiked={isLiked}
							onLikeToggle={user ? handleLikeToggle : undefined}
						/>
					</div>
				</div>
			</div>
		</PageTransition>
	);
}

export default function BookDetailPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-background">
					<Library className="h-12 w-12 mx-auto animate-pulse text-primary" />
				</div>
			}
		>
			<BookDetailPageContent />
		</Suspense>
	);
}
