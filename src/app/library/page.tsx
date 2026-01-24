"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Library, Menu, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
	AdvancedSearch,
	type AdvancedSearchFilters,
} from "@/components/books/advanced-search";
import { BookCardLarge } from "@/components/books/book-card-large";
import { BookCard } from "@/components/books/book-card-small";
import { BooksTable } from "@/components/books/books-table";
import { ViewModeToggle } from "@/components/books/view-mode-toggle";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LibraryHero } from "@/components/library/LibraryHero";
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
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { AdvancedSearchService } from "@/lib/services/advancedSearchService";
import type { Book as SupabaseBook } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Расширяем тип Book из supabase дополнительными полями
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

function LibraryContent() {
	const [supabase] = useState(() => getBrowserSupabase());
	const router = useRouter();
	const searchParams = useSearchParams();
	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [books, setBooks] = useState<Book[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [totalBooks, setTotalBooks] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("large-cards");
	const [advancedSearchService] = useState(
		() => new AdvancedSearchService(supabase),
	);
	const [isAdvancedSearch, setIsAdvancedSearch] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>(
		{
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
			sortBy: "created_at",
			sortOrder: "desc",
		},
	);

	// Инициализируем viewMode из URL параметра view
	useEffect(() => {
		const viewParam = searchParams.get("view") as ViewMode | null;
		if (
			viewParam &&
			["large-cards", "small-cards", "table"].includes(viewParam)
		) {
			setViewMode(viewParam);
		}
	}, [searchParams]);

	// Инициализируем booksPerPage из URL параметра limit
	const initialLimit = searchParams.get("limit");
	const [booksPerPage] = useState(() => {
		if (initialLimit === "all") return 0;
		const limit = parseInt(initialLimit || "100", 10);
		return Number.isNaN(limit) ? 10 : limit;
	});

	const loadBooks = useCallback(
		async (page = 1) => {
			try {
				// Сначала получаем общее количество книг
				const { count, error: countError } = await supabase
					.from("books")
					.select("*", { count: "exact", head: true });

				if (countError) {
					console.error("Error counting books:", countError);
				} else {
					setTotalBooks(count || 0);
				}

				// Затем получаем книги для текущей страницы
				// Если booksPerPage равно 0 ("Все"), то загружаем все книги
				if (booksPerPage === 0) {
					const { data, error } = await supabase
						.from("books")
						.select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
						.order("created_at", { ascending: false });

					if (error) {
						console.error("Error loading books:", error);
					} else {
						setBooks(data || []);
					}
				} else {
					const from = (page - 1) * booksPerPage;
					const to = from + booksPerPage - 1;

					const { data, error } = await supabase
						.from("books")
						.select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
						.order("created_at", { ascending: false })
						.range(from, to);

					if (error) {
						console.error("Error loading books:", error);
					} else {
						setBooks(data || []);
					}
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
			setLoading(true);
			try {
				// 1. Session & Profile
				const session = await getValidSession(supabase);
				const authUser = session?.user;
				setUser(authUser || null);

				if (authUser) {
					// Fetch user profile
					const { data: profile } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.maybeSingle();

					if (profile) {
						setUserProfile(profile as UserProfile);
					}
				}

				await loadBooks(currentPage);
			} catch (error) {
				console.error("Error loading initial data:", error);
			} finally {
				setLoading(false);
			}
		};

		getInitialData();

		return () => { };
	}, [supabase, router, loadBooks, currentPage]);

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
					setBooks(result.data);
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

	const handleTagClick = (tag: string) => {
		if (tag.startsWith("выше")) return; // Ignore rating tags for advanced filters for now, or handle appropriately

		const newTags = advancedFilters.tags.includes(tag)
			? advancedFilters.tags
			: [...advancedFilters.tags, tag];

		const newFilters = {
			...advancedFilters,
			tags: newTags,
		};

		handleAdvancedSearch(newFilters);
	};

	const handleAuthorClick = (author: string) => {
		const newFilters = {
			...advancedFilters,
			author: author,
			query: "", // Clear generic query if selecting specific author
		};
		handleAdvancedSearch(newFilters);
	};

	const handleSearch = (query: string) => {
		// Update basic search query in filters
		const newFilters = {
			...advancedFilters,
			query: query,
		};
		handleAdvancedSearch(newFilters);
	};

	const handleAdvancedSearchReset = useCallback(() => {
		setIsAdvancedSearch(false);
		setAdvancedFilters({
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
			sortBy: "created_at",
			sortOrder: "desc",
		});
		setSearchQuery("");
		setCurrentPage(1);
		loadBooks(1);
	}, [loadBooks]);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	const incrementDownloads = async (bookId: string) => {
		try {
			await supabase.rpc("increment_downloads", { book_id: bookId });
			setBooks(
				books.map((book) =>
					book.id === bookId
						? { ...book, downloads_count: book.downloads_count + 1 }
						: book,
				),
			);
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

	const handleBookClick = (book: Book) => {
		router.push(`/book/${book.id}`);
	};

	const handleRead = (book: Book) => {
		if (book.file_url) {
			incrementViews(book.id);
			router.push(`/reader?bookId=${book.id}`);
		}
	};

	const incrementViews = async (bookId: string) => {
		try {
			await supabase.rpc("increment_views", { book_id: bookId });
			setBooks(
				books.map((book) =>
					book.id === bookId
						? { ...book, views_count: book.views_count + 1 }
						: book,
				),
			);
		} catch (error) {
			console.error("Error incrementing views:", error);
		}
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
				console.error("❌ Ошибка при очистке файла:", error);
				alert("Ошибка при очистке файла");
			} else {
				setBooks(
					books.map((book) =>
						book.id === bookId
							? ({
								...book,
								file_url: undefined,
								file_size: undefined,
								file_format: undefined,
								telegram_file_id: undefined,
							} as unknown as Book)
							: book,
					),
				);
				alert("Файл успешно очищен!");
			}
		} catch (error) {
			console.error("❌ Ошибка:", error);
			alert("Произошла ошибка при очистке файла");
		}
	};

	// Загружаем сохраненный режим отображения при монтировании компонента
	useEffect(() => {
		const savedViewMode = localStorage.getItem(
			"libraryViewMode",
		) as ViewMode | null;
		if (savedViewMode) {
			setViewMode(savedViewMode);
		}
	}, []);

	// Сохраняем режим отображения при его изменении
	const handleViewModeChange = (mode: ViewMode) => {
		setViewMode(mode);
		localStorage.setItem("libraryViewMode", mode);
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<Library className="h-12 w-12 mx-auto animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка библиотеки...</p>
				</div>
			</div>
		);
	}

	const totalPages =
		booksPerPage === 0 ? 1 : Math.ceil(totalBooks / booksPerPage);

	return (
		<PageTransition>
			<div className="flex h-screen bg-transparent overflow-hidden">
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

					<main className="flex-1 overflow-y-auto scrollbar-hide">
						<LibraryHero />

						<div className="container mx-auto px-4 pb-12">
							<div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
								<AdvancedSearch
									onSearch={handleAdvancedSearch}
									onReset={handleAdvancedSearchReset}
									isLoading={loading}
									values={advancedFilters}
									onFilterChange={setAdvancedFilters}
								/>
							</div>

							<div className="flex items-center justify-between mb-6">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									{totalBooks} книг найдено
								</div>
								<div className="flex items-center gap-4">
									<ViewModeToggle
										viewMode={viewMode}
										onViewModeChange={handleViewModeChange}
									/>
								</div>
							</div>

							{viewMode === "table" ? (
								<BooksTable
									books={books}
									onDelete={
										userProfile?.role === "admin"
											? (book) => handleClearFile(book.id)
											: undefined
									}
									onBookClick={handleBookClick}
									onDownload={handleDownload}
									onRead={handleRead}
								/>
							) : viewMode === "large-cards" ? (
								<div className="space-y-6">
									{books.map((book) => (
										<BookCardLarge
											key={book.id}
											book={book}
											onDownload={handleDownload}
											onRead={handleRead}
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
								<div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
									{books.map((book, i) => (
										<div
											key={book.id}
											onClick={() => handleBookClick(book)}
											className="cursor-pointer h-full"
										>
											<ModernBookCard book={book} index={i} />
										</div>
									))}
								</div>
							)}

							{books.length === 0 && (
								<div className="text-center py-20 text-muted-foreground">
									<Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
									<p className="text-lg font-medium">Книги не найдены</p>
									<p>Попробуйте изменить параметры поиска</p>
								</div>
							)}

							{totalPages > 1 && (
								<div className="mt-12 flex justify-center">
									<Pagination>
										<PaginationContent>
											<PaginationItem>
												<PaginationPrevious
													href="#"
													onClick={(e) => {
														e.preventDefault();
														if (currentPage > 1) {
															setCurrentPage((p) => p - 1);
															if (booksPerPage === 0) {
																loadBooks(1);
															} else {
																loadBooks(currentPage - 1);
															}
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
													(p) =>
														p === 1 ||
														p === totalPages ||
														Math.abs(p - currentPage) <= 1,
												)
												.map((p, i, arr) => (
													<div key={p} className="flex items-center">
														{i > 0 && arr[i - 1] !== p - 1 && (
															<PaginationItem>
																<span className="px-4 text-muted-foreground">
																	...
																</span>
															</PaginationItem>
														)}
														<PaginationItem>
															<PaginationLink
																href="#"
																isActive={currentPage === p}
																onClick={(e) => {
																	e.preventDefault();
																	setCurrentPage(p);
																	if (booksPerPage === 0) {
																		loadBooks(1);
																	} else {
																		loadBooks(p);
																	}
																}}
															>
																{p}
															</PaginationLink>
														</PaginationItem>
													</div>
												))}
											<PaginationItem>
												<PaginationNext
													href="#"
													onClick={(e) => {
														e.preventDefault();
														if (currentPage < totalPages) {
															setCurrentPage((p) => p + 1);
															if (booksPerPage === 0) {
																loadBooks(1);
															} else {
																loadBooks(currentPage + 1);
															}
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
							)}
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
				<div className="min-h-screen flex items-center justify-center bg-background">
					<Library className="h-12 w-12 mx-auto animate-pulse text-primary" />
				</div>
			}
		>
			<LibraryContent />
		</Suspense>
	);
}
