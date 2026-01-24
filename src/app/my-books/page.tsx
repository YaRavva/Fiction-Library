"use client";

import type { Session } from "@supabase/supabase-js";
import { BookOpen, Clock, Heart, Library } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookCard } from "@/components/books/book-card-small";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
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
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<Library className="h-12 w-12 mx-auto animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen bg-background overflow-hidden">
			<AppSidebar
				user={user}
				userProfile={userProfile}
				onLogout={handleLogout}
			/>
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
				{/* Header */}
				<header className="flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-xl sticky top-0 z-30">
					<div className="flex items-center gap-2">
						<Library className="h-6 w-6 text-primary" />
						<span className="font-bold text-lg">Мои книги</span>
					</div>
				</header>

				<main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12">
					{/* Reading Now */}
					<section>
						<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
							<Clock className="w-6 h-6 text-primary" />
							Читаю сейчас
						</h2>

						{history.length > 0 ? (
							<div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
								{history.map((item, i) => (
									<BookCard
										key={item.id}
										book={item.book}
										index={i}
										onRead={handleRead}
										onDownload={handleDownload}
										onBookClick={handleBookClick}
										// onTagClick can be added if needed
									/>
								))}
							</div>
						) : (
							<div className="p-12 border rounded-2xl bg-muted/20 text-center flex flex-col items-center justify-center dashed border-dashed">
								<BookOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
								<h3 className="text-lg font-medium">Нет активных книг</h3>
								<p className="text-muted-foreground mb-6">
									Вы пока не начали читать ни одной книги
								</p>
								<Button onClick={() => router.push("/library")}>
									Найти книгу
								</Button>
							</div>
						)}
					</section>

					{/* Favorites */}
					<section>
						<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
							<Heart className="w-6 h-6 text-red-500" />
							Избранное
						</h2>
						{favorites.length > 0 ? (
							<div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
								{favorites.map((item, i) => (
									<BookCard
										key={item.id}
										book={item.book}
										index={i}
										onRead={handleRead}
										onDownload={handleDownload}
										onBookClick={handleBookClick}
									/>
								))}
							</div>
						) : (
							<div className="p-12 border rounded-2xl bg-muted/20 text-center flex flex-col items-center justify-center dashed border-dashed">
								<Heart className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
								<h3 className="text-lg font-medium">Список пуст</h3>
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
				</main>
			</div>
		</div>
	);
}
