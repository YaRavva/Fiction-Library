"use client";

import type { Session } from "@supabase/supabase-js";
import { BookOpen, Clock, Heart, Library } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookCardLarge } from "@/components/books/book-card-large";
import { BooksTable } from "@/components/books/books-table";
import { ViewModeToggle } from "@/components/books/view-mode-toggle";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ModernBookCard } from "@/components/modern/ModernBookCard";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import type { Book } from "@/lib/supabase";

type ViewMode = "large-cards" | "small-cards" | "table";

interface FavoriteItem {
	id: string;
	book: Book;
}

interface ReadingHistoryItem {
	id: string;
	book_id: string;
	last_read_at: string;
	book: Book;
}

interface UserProfile {
	id: string;
	username?: string;
	display_name?: string;
	role: string;
}

export default function MyBooksPage() {
	const [supabase] = useState(() => getBrowserSupabase());
	const router = useRouter();
	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
	const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [viewMode, setViewMode] = useState<ViewMode>("large-cards");

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			try {
				// 1. Session & Profile
				const session = await getValidSession(supabase);
				const authUser = session?.user;
				setUser(authUser || null);

				if (!authUser) {
					router.push("/auth/login");
					return;
				}

				if (authUser) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.maybeSingle();

					if (profile) {
						setUserProfile(profile as UserProfile);
					}
				}

				// Fetch Reading History
				const { data: historyData, error: historyError } = await supabase
					.from("reading_history")
					.select(`
						id,
						book_id,
						last_read_at,
						book:books(*)
					`)
					.eq("user_id", authUser.id)
					.order("last_read_at", { ascending: false });

				if (historyError) {
					console.error("Error loading history:", historyError);
				} else {
					setHistory(historyData as unknown as ReadingHistoryItem[]);
				}

				// Fetch Favorites
				const { data: favData, error: favError } = await supabase
					.from("user_favorites")
					.select(`
						id,
						book:books(*)
					`)
					.eq("user_id", authUser.id)
					.order("created_at", { ascending: false });

				if (favError) {
					console.error("Error loading favorites:", favError);
				} else {
					setFavorites(favData as unknown as FavoriteItem[]);
				}
			} catch (error) {
				console.error("Error loading data:", error);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [supabase]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	const handleBookClick = (book: Book) => {
		router.push(`/book/${book.id}`);
	};

	const handleRead = (book: Book) => {
		router.push(`/reader?bookId=${book.id}`);
	};

	const handleDownload = (book: Book) => {
		if (book.file_url) {
			window.location.href = `/api/download/${book.id}`;
		}
	};

	const renderBooks = (items: Array<{ id: string; book: Book }>) => {
		const books = items.map((item) => item.book);

		if (viewMode === "table") {
			return (
				<BooksTable
					books={books}
					onBookClick={handleBookClick}
					onDownload={handleDownload}
					onReadClick={handleRead}
				/>
			);
		}

		if (viewMode === "small-cards") {
			return (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
					{items.map((item, index) => (
						<div
							key={item.id}
							className="h-full cursor-pointer"
							onClick={() => handleBookClick(item.book)}
						>
							<ModernBookCard book={item.book} index={index} />
						</div>
					))}
				</div>
			);
		}

		return (
			<div className="space-y-3">
				{items.map((item) => (
					<BookCardLarge
						key={item.id}
						book={item.book}
						onRead={handleRead}
						onDownload={handleDownload}
						onBookClick={handleBookClick}
					/>
				))}
			</div>
		);
	};

	if (loading) {
		return (
			<div className="app-main-gradient flex min-h-screen items-center justify-center">
				<div className="space-y-4 text-center">
					<Library className="mx-auto size-10 animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка...</p>
				</div>
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="app-main-gradient flex h-screen overflow-hidden">
				<div className="hidden lg:block">
					<AppSidebar
						user={user}
						userProfile={userProfile}
						onLogout={handleLogout}
					/>
				</div>
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<header className="sticky top-0 z-30 border-b bg-background">
						<div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
							<div className="min-w-0">
								<p className="text-muted-foreground text-xs">Личная полка</p>
								<h1 className="font-semibold text-lg tracking-tight">
									Мои книги
								</h1>
							</div>
						</div>
					</header>

					<main className="flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[1480px] space-y-8 px-4 py-5 sm:px-6 lg:px-8">
							<section className="flex justify-end">
								<ViewModeToggle
									viewMode={viewMode}
									onViewModeChange={setViewMode}
								/>
							</section>

							<section>
								<h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
									<Clock className="size-5 text-primary" />
									Читаю сейчас
									<span className="rounded-md border bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
										{history.length}
									</span>
								</h2>

								{history.length > 0 ? (
									renderBooks(history)
								) : (
									<div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
										<BookOpen className="mb-4 size-10 text-muted-foreground/50" />
										<h3 className="font-medium text-lg">Нет активных книг</h3>
										<p className="mb-6 text-muted-foreground">
											Вы пока не начали читать ни одной книги
										</p>
										<Button onClick={() => router.push("/library")}>
											Найти книгу
										</Button>
									</div>
								)}
							</section>

							<section>
								<h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
									<Heart className="size-5 text-red-500" />
									Избранное
									<span className="rounded-md border bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs tabular-nums">
										{favorites.length}
									</span>
								</h2>
								{favorites.length > 0 ? (
									renderBooks(favorites)
								) : (
									<div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
										<Heart className="mb-4 size-10 text-muted-foreground/50" />
										<h3 className="font-medium text-lg">Список пуст</h3>
										<p className="text-muted-foreground">
											У вас пока нет избранных книг
										</p>
										<Button
											className="mt-6"
											variant="outline"
											onClick={() => router.push("/library")}
										>
											Перейти в библиотеку
										</Button>
									</div>
								)}
							</section>
						</div>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}
