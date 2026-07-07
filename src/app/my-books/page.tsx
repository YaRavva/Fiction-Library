"use client";

import type { Session } from "@supabase/supabase-js";
import { BookOpen, Clock, Heart, Library } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookCardLarge } from "@/components/books/book-card-large";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import type { Book } from "@/lib/supabase";

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

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="space-y-4 text-center">
					<Library className="mx-auto size-10 animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка...</p>
				</div>
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-screen overflow-hidden bg-background">
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
							<section className="grid gap-3 sm:grid-cols-2">
								<div className="rounded-lg border bg-card p-4">
									<div className="flex items-center gap-2 text-muted-foreground text-sm">
										<Clock className="size-4" />
										Читаю сейчас
									</div>
									<div className="mt-2 font-semibold text-3xl tabular-nums">
										{history.length}
									</div>
								</div>
								<div className="rounded-lg border bg-card p-4">
									<div className="flex items-center gap-2 text-muted-foreground text-sm">
										<Heart className="size-4" />
										Избранное
									</div>
									<div className="mt-2 font-semibold text-3xl tabular-nums">
										{favorites.length}
									</div>
								</div>
							</section>

							<section>
								<h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
									<Clock className="size-5 text-primary" />
									Читаю сейчас
								</h2>

								{history.length > 0 ? (
									<div className="space-y-3">
										{history.map((item, i) => (
											<BookCardLarge
												key={item.id}
												book={item.book}
												onRead={handleRead}
												onDownload={handleDownload}
												onBookClick={handleBookClick}
											/>
										))}
									</div>
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
								</h2>
								{favorites.length > 0 ? (
									<div className="space-y-3">
										{favorites.map((item, i) => (
											<BookCardLarge
												key={item.id}
												book={item.book}
												onRead={handleRead}
												onDownload={handleDownload}
												onBookClick={handleBookClick}
											/>
										))}
									</div>
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
