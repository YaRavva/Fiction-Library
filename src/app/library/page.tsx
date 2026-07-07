"use client";

import type { Session } from "@supabase/supabase-js";
import {
	BookOpenCheck,
	Database,
	Library,
	Menu,
	Search,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
	AdvancedSearch,
	type AdvancedSearchFilters,
} from "@/components/books/advanced-search";
import { BookCardLarge } from "@/components/books/book-card-large";
import { BooksTable } from "@/components/books/books-table";
import { ViewModeToggle } from "@/components/books/view-mode-toggle";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ModernBookCard } from "@/components/modern/ModernBookCard";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { AdvancedSearchService } from "@/lib/services/advancedSearchService";
import type { Book as SupabaseBook } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

type ViewMode = "large-cards" | "small-cards" | "table";

const defaultFilters: AdvancedSearchFilters = {
	query: "",
	author: "",
	series: "",
	genre: "",
	minRating: null,
	maxRating: null,
	yearFrom: null,
	yearTo: null,
	hasFile: null,
	tags: [],
	sortBy: "rating",
	sortOrder: "desc",
};

function LibraryContent() {
	const [supabase] = useState(() => getBrowserSupabase());
	const [advancedSearchService] = useState(
		() => new AdvancedSearchService(supabase),
	);
	const router = useRouter();
	const searchParams = useSearchParams();

	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [books, setBooks] = useState<Book[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalBooks, setTotalBooks] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("large-cards");
	const [advancedFilters, setAdvancedFilters] =
		useState<AdvancedSearchFilters>(defaultFilters);
	const [isAdvancedSearch, setIsAdvancedSearch] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const initialLimit = searchParams.get("limit");
	const [booksPerPage] = useState(() => {
		if (initialLimit === "all") return 0;
		const limit = parseInt(initialLimit || "100", 10);
		return Number.isNaN(limit) ? 100 : limit;
	});

	useEffect(() => {
		const viewParam = searchParams.get("view") as ViewMode | null;
		if (
			viewParam &&
			["large-cards", "small-cards", "table"].includes(viewParam)
		) {
			setViewMode(viewParam);
			return;
		}

		const savedViewMode = localStorage.getItem(
			"libraryViewMode",
		) as ViewMode | null;
		if (savedViewMode) setViewMode(savedViewMode);
	}, [searchParams]);

	const loadBooks = useCallback(
		async (page = 1) => {
			setLoading(true);

			try {
				const { count, error: countError } = await supabase
					.from("books")
					.select("*", { count: "exact", head: true });

				if (countError) {
					console.error("Error counting books:", countError);
				} else {
					setTotalBooks(count || 0);
				}

				let query = supabase
					.from("books")
					.select(`
						*,
						series:series_id(id, title, author, series_composition, cover_urls)
					`)
					.order("rating", { ascending: false, nullsFirst: false })
					.order("title", { ascending: true, nullsFirst: false });

				if (booksPerPage !== 0) {
					const from = (page - 1) * booksPerPage;
					query = query.range(from, from + booksPerPage - 1);
				}

				const { data, error } = await query;

				if (error) {
					console.error("Error loading books:", error);
				} else {
					setBooks((data || []) as Book[]);
				}
			} catch (error) {
				console.error("Error loading books:", error);
			} finally {
				setLoading(false);
			}
		},
		[supabase, booksPerPage],
	);

	useEffect(() => {
		const getInitialData = async () => {
			try {
				const session = await getValidSession(supabase);
				const authUser = session?.user;
				setUser(authUser || null);

				if (authUser) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.maybeSingle();

					if (profile) setUserProfile(profile as UserProfile);
				}

				await loadBooks(currentPage);
			} catch (error) {
				console.error("Error loading initial data:", error);
				setLoading(false);
			}
		};

		getInitialData();
	}, [supabase, loadBooks, currentPage]);

	const handleAdvancedSearch = useCallback(
		async (filters: AdvancedSearchFilters) => {
			setLoading(true);
			setIsAdvancedSearch(true);
			setCurrentPage(1);
			setAdvancedFilters(filters);

			try {
				const result = await advancedSearchService.searchBooks(
					filters,
					1,
					booksPerPage === 0 ? 0 : booksPerPage,
				);

				if (result.error) {
					console.error("Advanced search error:", result.error);
				} else {
					setBooks(result.data as Book[]);
					setTotalBooks(result.count);
				}
			} catch (error) {
				console.error("Advanced search failed:", error);
			} finally {
				setLoading(false);
			}
		},
		[advancedSearchService, booksPerPage],
	);

	const handleAdvancedSearchReset = useCallback(() => {
		setIsAdvancedSearch(false);
		setAdvancedFilters(defaultFilters);
		setCurrentPage(1);
		loadBooks(1);
	}, [loadBooks]);

	const handleViewModeChange = (mode: ViewMode) => {
		setViewMode(mode);
		localStorage.setItem("libraryViewMode", mode);
	};

	const handleTagClick = (tag: string) => {
		if (tag.startsWith("выше")) return;

		handleAdvancedSearch({
			...advancedFilters,
			tags: advancedFilters.tags.includes(tag)
				? advancedFilters.tags
				: [...advancedFilters.tags, tag],
		});
	};

	const handleAuthorClick = (author: string) => {
		handleAdvancedSearch({
			...advancedFilters,
			author,
			query: "",
		});
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	const incrementDownloads = async (bookId: string) => {
		try {
			await supabase.rpc("increment_downloads", { book_id: bookId });
			setBooks((items) =>
				items.map((book) =>
					book.id === bookId
						? { ...book, downloads_count: book.downloads_count + 1 }
						: book,
				),
			);
		} catch (error) {
			console.error("Error incrementing downloads:", error);
		}
	};

	const incrementViews = async (bookId: string) => {
		try {
			await supabase.rpc("increment_views", { book_id: bookId });
			setBooks((items) =>
				items.map((book) =>
					book.id === bookId
						? { ...book, views_count: book.views_count + 1 }
						: book,
				),
			);
		} catch (error) {
			console.error("Error incrementing views:", error);
		}
	};

	const handleDownload = (book: Book) => {
		if (book.file_url) {
			incrementDownloads(book.id);
			window.location.href = `/api/download/${book.id}`;
		}
	};

	const handleRead = (book: Book) => {
		if (book.file_url) {
			incrementViews(book.id);
			router.push(`/reader?bookId=${book.id}`);
		}
	};

	const handleBookClick = (book: Book) => {
		router.push(`/book/${book.id}`);
	};

	const handleClearFile = async (bookId: string) => {
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
				.eq("id", bookId);

			if (error) {
				console.error("Error clearing file:", error);
				window.alert("Не удалось очистить файл.");
				return;
			}

			setBooks((items) =>
				items.map((book) =>
					book.id === bookId
						? ({
								...book,
								file_url: undefined,
								file_size: undefined,
								file_format: "",
								telegram_file_id: undefined,
							} as unknown as Book)
						: book,
				),
			);
		} catch (error) {
			console.error("Error clearing file:", error);
			window.alert("Произошла ошибка при очистке файла.");
		}
	};

	if (loading && books.length === 0) {
		return (
			<div className="app-main-gradient flex min-h-screen items-center justify-center">
				<div className="space-y-4 text-center">
					<Library className="mx-auto size-10 animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка библиотеки...</p>
				</div>
			</div>
		);
	}

	const totalPages =
		booksPerPage === 0 ? 1 : Math.ceil(totalBooks / booksPerPage);

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
								<div className="flex items-center gap-2 lg:hidden">
									<Library className="size-5 text-primary" />
									<span className="font-semibold">Fiction Library</span>
								</div>
								<div className="hidden lg:block">
									<p className="text-muted-foreground text-xs">Каталог</p>
									<h1 className="font-semibold text-lg tracking-tight">
										Библиотека
									</h1>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<ThemeToggle />
								<Button
									variant="outline"
									size="icon"
									className="lg:hidden"
									onClick={() => setMobileMenuOpen(true)}
								>
									<Menu className="size-5" />
								</Button>
							</div>
						</div>
					</header>

					{mobileMenuOpen ? (
						<div className="fixed inset-0 z-50 bg-background/80 lg:hidden">
							<button
								type="button"
								className="absolute inset-0 h-full w-full"
								aria-label="Закрыть меню"
								onClick={() => setMobileMenuOpen(false)}
							/>
							<div className="fixed inset-y-0 left-0 z-10 flex w-72 flex-col bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
								<div className="flex items-center justify-between border-b p-4">
									<span className="font-semibold">Меню</span>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setMobileMenuOpen(false)}
									>
										<X className="size-5" />
									</Button>
								</div>
								<AppSidebar
									user={user}
									userProfile={userProfile}
									onLogout={handleLogout}
								/>
							</div>
						</div>
					) : null}

					<main className="flex-1 overflow-y-auto">
						<div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
							<section className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
								<div className="space-y-2">
									<p className="text-muted-foreground text-sm">
										Поиск, фильтрация и быстрый доступ к файлам
									</p>
									<div className="flex flex-wrap items-center gap-2">
										<div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
											<Database className="size-4 text-muted-foreground" />
											<span className="font-semibold tabular-nums">
												{totalBooks}
											</span>
											<span className="text-muted-foreground">книг в базе</span>
										</div>
										<div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
											<BookOpenCheck className="size-4 text-muted-foreground" />
											<span className="font-semibold tabular-nums">
												{books.length}
											</span>
											<span className="text-muted-foreground">
												показано сейчас
											</span>
										</div>
										{isAdvancedSearch ? (
											<div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-primary text-sm">
												<Search className="size-4" />
												активный поиск
											</div>
										) : null}
									</div>
								</div>

								<ViewModeToggle
									viewMode={viewMode}
									onViewModeChange={handleViewModeChange}
								/>
							</section>

							<div className="mb-5">
								<AdvancedSearch
									onSearch={handleAdvancedSearch}
									onReset={handleAdvancedSearchReset}
									isLoading={loading}
									values={advancedFilters}
									onFilterChange={setAdvancedFilters}
								/>
							</div>

							{viewMode === "table" ? (
								<BooksTable
									books={books}
									onBookClick={handleBookClick}
									onDownload={handleDownload}
									onReadClick={handleRead}
									onTagClick={handleTagClick}
								/>
							) : viewMode === "large-cards" ? (
								<div className="space-y-3">
									{books.map((book) => (
										<BookCardLarge
											key={book.id}
											book={book}
											onDownload={handleDownload}
											onRead={handleRead}
											onBookClick={handleBookClick}
											onTagClick={handleTagClick}
											userProfile={userProfile}
											onFileClear={
												userProfile?.role === "admin"
													? (id) => handleClearFile(id)
													: undefined
											}
											onAuthorClick={handleAuthorClick}
										/>
									))}
								</div>
							) : (
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
									{books.map((book, index) => (
										<div
											key={book.id}
											className="h-full cursor-pointer"
											onClick={() => handleBookClick(book)}
										>
											<ModernBookCard book={book} index={index} />
										</div>
									))}
								</div>
							)}

							{books.length === 0 ? (
								<div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
									<Search className="mx-auto mb-4 size-10 opacity-30" />
									<p className="font-medium text-foreground">
										Книги не найдены
									</p>
									<p className="mt-1 text-sm">
										Измените запрос или сбросьте фильтры.
									</p>
								</div>
							) : null}

							{totalPages > 1 ? (
								<div className="mt-8 flex justify-center">
									<Pagination>
										<PaginationContent>
											<PaginationItem>
												<PaginationPrevious
													href="#"
													onClick={(event) => {
														event.preventDefault();
														if (currentPage > 1) {
															const page = currentPage - 1;
															setCurrentPage(page);
															loadBooks(page);
														}
													}}
													className={
														currentPage <= 1
															? "pointer-events-none opacity-50"
															: ""
													}
												/>
											</PaginationItem>

											{Array.from({ length: totalPages }, (_, i) => i + 1)
												.filter(
													(page) =>
														page === 1 ||
														page === totalPages ||
														Math.abs(page - currentPage) <= 1,
												)
												.map((page, index, pages) => (
													<div key={page} className="flex items-center">
														{index > 0 && pages[index - 1] !== page - 1 ? (
															<PaginationItem>
																<span className="px-4 text-muted-foreground">
																	...
																</span>
															</PaginationItem>
														) : null}
														<PaginationItem>
															<PaginationLink
																href="#"
																isActive={currentPage === page}
																onClick={(event) => {
																	event.preventDefault();
																	setCurrentPage(page);
																	loadBooks(page);
																}}
															>
																{page}
															</PaginationLink>
														</PaginationItem>
													</div>
												))}

											<PaginationItem>
												<PaginationNext
													href="#"
													onClick={(event) => {
														event.preventDefault();
														if (currentPage < totalPages) {
															const page = currentPage + 1;
															setCurrentPage(page);
															loadBooks(page);
														}
													}}
													className={
														currentPage >= totalPages
															? "pointer-events-none opacity-50"
															: ""
													}
												/>
											</PaginationItem>
										</PaginationContent>
									</Pagination>
								</div>
							) : null}
						</div>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}

export default function LibraryPage() {
	return (
		<Suspense
			fallback={
				<div className="app-main-gradient flex min-h-screen items-center justify-center">
					<Library className="mx-auto size-10 animate-pulse text-primary" />
				</div>
			}
		>
			<LibraryContent />
		</Suspense>
	);
}
