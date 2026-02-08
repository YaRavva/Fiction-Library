"use client";

import type { Session } from "@supabase/supabase-js";
import DOMPurify from "dompurify";
import JSZip from "jszip";
import {
	BookOpen,
	ChevronLeft,
	Download,
	List,
	Menu,
	Type,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import type { Book } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface UserProfile {
	id: string;
	username?: string;
	display_name?: string;
	role: string;
}

function ReaderContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const bookId = searchParams.get("bookId");

	const [supabase] = useState(() => getBrowserSupabase());
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [content, setContent] = useState<string>("");
	const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [showFileSelector, setShowFileSelector] = useState(false);
	const [fontSize, setFontSize] = useState(18);
	const [user, setUser] = useState<Session["user"] | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Reader Stats & Navigation
	const scrollRef = useRef<HTMLDivElement>(null);
	const [progress, setProgress] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [chapters, setChapters] = useState<{ title: string; offset: number }[]>(
		[],
	);
	const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

	// Сохранение прогресса
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const scrollTargetRef = useRef<number | null>(null);

	const saveProgress = useCallback(
		(
			file: string | null,
			position: number,
			progressPct: number,
			userId: string,
			bookId: string,
		) => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

			saveTimeoutRef.current = setTimeout(async () => {
				try {
					await supabase.from("reading_history").upsert(
						{
							user_id: userId,
							book_id: bookId,
							current_file: file,
							last_position: Math.round(position),
							reading_progress: progressPct,
							last_read_at: new Date().toISOString(),
						},
						{ onConflict: "user_id, book_id" },
					);
				} catch (e) {
					console.error("Error saving progress:", e);
				}
			}, 2000); // Debounce 2 sec
		},
		[supabase],
	);

	const handleScroll = () => {
		if (scrollRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

			// Progress
			const prog = (scrollTop / (scrollHeight - clientHeight)) * 100;
			setProgress(Math.min(100, Math.max(0, prog)));

			// Pages (Simulated based on screen height)
			const total = Math.ceil(scrollHeight / clientHeight);
			const current = Math.ceil(scrollTop / clientHeight) + 1;
			setTotalPages(Math.max(1, total));
			setCurrentPage(Math.min(current, total));

			// Current Chapter
			const currentChap = chapters.reduce((prev, curr, idx) => {
				if (curr.offset <= scrollTop + 100) return idx;
				return prev;
			}, 0);
			setCurrentChapterIndex(currentChap);

			// Save Progress
			if (user && book) {
				saveProgress(selectedFile, scrollTop, prog, user.id, book.id);
			}
		}
	};

	const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		if (scrollRef.current) {
			const { scrollHeight, clientHeight } = scrollRef.current;
			const scrollTo = (val / 100) * (scrollHeight - clientHeight);
			scrollRef.current.scrollTop = scrollTo;
		}
	};

	const scrollToChapter = (index: number) => {
		if (chapters[index] && scrollRef.current) {
			scrollRef.current.scrollTop = chapters[index].offset;
		}
	};

	const formatContent = (text: string, fileName: string) => {
		if (fileName.toLowerCase().endsWith(".fb2")) {
			// Basic FB2-to-HTML conversion
			let body = text;

			// Try to extract body to skip metadata
			const bodyMatch = text.match(/<body>([\s\S]*)<\/body>/i);
			if (bodyMatch) {
				body = bodyMatch[1];
			}

			return body
				.replace(/<section[^>]*>/gi, '<div class="section mb-8">')
				.replace(/<\/section>/gi, "</div>")
				.replace(
					/<title[^>]*>/gi,
					'<h3 class="chapter-title text-2xl font-bold mt-8 mb-4">',
				)
				.replace(/<\/title>/gi, "</h3>")
				.replace(
					/<subtitle[^>]*>/gi,
					'<h4 class="text-xl font-semibold mt-4 mb-2">',
				)
				.replace(/<\/subtitle>/gi, "</h4>")
				.replace(/<p[^>]*>/gi, '<p class="mb-4 text-lg leading-relaxed">')
				.replace(/<\/p>/gi, "</p>")
				.replace(/<empty-line\/>/gi, "<br/>")
				.replace(/<image[^>]*>/gi, "") // Hide images
				.replace(/<a[^>]*>/gi, "") // Strip links
				.replace(/<\/a>/gi, "");
		}
		if (fileName.toLowerCase().endsWith(".txt")) {
			return text
				.split("\n")
				.map((line) =>
					line.trim()
						? `<p class="mb-4 text-lg leading-relaxed">${line}</p>`
						: "<br/>",
				)
				.join("");
		}
		return text;
	};

	// Parse Chapters & Update Stats & Initial Scroll
	useEffect(() => {
		if (content && scrollRef.current) {
			// If we switched file manually (not initial load with history), reset to top
			if (scrollTargetRef.current === null) {
				scrollRef.current.scrollTop = 0;
			}

			// Allow DOM to update
			setTimeout(() => {
				if (!scrollRef.current) return;

				// Restore scroll from history
				if (scrollTargetRef.current !== null) {
					scrollRef.current.scrollTop = scrollTargetRef.current;
					scrollTargetRef.current = null;
				}

				// Update total pages
				const { scrollHeight, clientHeight } = scrollRef.current;
				setTotalPages(Math.max(1, Math.ceil(scrollHeight / clientHeight)));

				// Verify current page from actual scrollTop
				const scrollTop = scrollRef.current.scrollTop;
				const current = Math.ceil(scrollTop / clientHeight) + 1;
				setCurrentPage(current);
				const prog = (scrollTop / (scrollHeight - clientHeight)) * 100;
				setProgress(Math.min(100, Math.max(0, prog || 0)));

				// Find chapters
				const headers = Array.from(
					scrollRef.current.querySelectorAll(
						"h1, h2, h3, h4, .chapter-title, .title",
					),
				);
				const chaps = headers
					.map((h) => ({
						title:
							h.textContent?.trim().slice(0, 100).replace(/\s+/g, " ") ||
							"Chapter",
						offset: (h as HTMLElement).offsetTop,
					}))
					.filter((c) => c.title.length > 0);

				if (chaps.length > 0) {
					setChapters(chaps);
					// Update current chapter index based on position
					const currentChap = chaps.reduce((prev, curr, idx) => {
						if (curr.offset <= scrollTop + 100) return idx;
						return prev;
					}, 0);
					setCurrentChapterIndex(currentChap);
				} else {
					setChapters([]);
				}
			}, 300);
		}
	}, [content]);

	const decodeText = (buffer: ArrayBuffer | Uint8Array): string => {
		try {
			// Try UTF-8 first with fatal=true to catch invalid sequences
			const decoder = new TextDecoder("utf-8", { fatal: true });
			return decoder.decode(buffer);
		} catch (e) {
			// Fallback to windows-1251 if UTF-8 fails (common for old RU books)
			try {
				const legacyDecoder = new TextDecoder("windows-1251");
				return legacyDecoder.decode(buffer);
			} catch (legacyError) {
				// If specific legacy decode fails, fall back to loose UTF-8
				const safeDecoder = new TextDecoder("utf-8");
				return safeDecoder.decode(buffer);
			}
		}
	};

	// Загрузка содержимого одиночного файла
	const loadFileContent = useCallback(async () => {
		try {
			const response = await fetch(`/api/reader/${bookId}`);
			if (!response.ok) throw new Error("Network response was not ok");
			const buffer = await response.arrayBuffer();
			const text = decodeText(buffer);
			setContent(formatContent(text, `book.fb2`)); // Assume fb2/txt if unknown
		} catch (error) {
			console.error("Error loading file content:", error);
			setContent("Ошибка при загрузке файла.");
		}
	}, [bookId]);

	// Загрузка содержимого архива
	const loadZipContent = useCallback(
		async (historyFile?: string) => {
			try {
				const response = await fetch(`/api/reader/${bookId}`);
				if (!response.ok) throw new Error("Network response was not ok");

				// Try to load as ArrayBuffer first since we expect a ZIP
				const arrayBuffer = await response.arrayBuffer();

				try {
					const zip = new JSZip();
					const zipContent = await zip.loadAsync(arrayBuffer);

					const fileContents: { name: string; content: string }[] = [];
					const filePromises: Promise<void>[] = [];

					zipContent.forEach(
						(relativePath: string, zipEntry: JSZip.JSZipObject) => {
							if (
								!zipEntry.dir &&
								(relativePath.endsWith(".fb2") ||
									relativePath.endsWith(".txt") ||
									relativePath.endsWith(".xml")) &&
								!relativePath.includes("__MACOSX/") &&
								!relativePath.includes("/._")
							) {
								filePromises.push(
									zipEntry.async("uint8array").then((buffer: Uint8Array) => {
										const text = decodeText(buffer);
										const formatted = formatContent(text, relativePath);
										fileContents.push({
											name: relativePath,
											content: formatted,
										});
									}),
								);
							}
						},
					);

					await Promise.all(filePromises);

					// Sort files by name to be deterministic
					fileContents.sort((a, b) => a.name.localeCompare(b.name));

					setFiles(fileContents);

					// Use history file if available and valid, else first file
					const initialFile =
						historyFile && fileContents.some((f) => f.name === historyFile)
							? fileContents.find((f) => f.name === historyFile)
							: fileContents[0];

					if (fileContents.length > 0 && initialFile) {
						if (fileContents.length > 1) setShowFileSelector(true);
						setSelectedFile(initialFile.name);
						setContent(initialFile.content);
					} else {
						// No valid files found in ZIP, try treating response as text
						console.warn(
							"No valid files found in ZIP, falling back to text decoding",
						);
						setContent(formatContent(decodeText(arrayBuffer), "unknown.txt"));
					}
				} catch (zipError) {
					console.warn(
						"Failed to parse ZIP, trying to read as text file:",
						zipError,
					);
					// It might be a regular file (fb2/txt) mislabeled as zip, or just failed to unzip
					setContent(formatContent(decodeText(arrayBuffer), "book.txt"));
				}
			} catch (error) {
				console.error("Error loading content:", error);
				setContent("Ошибка при загрузке содержимого.");
			}
		},
		[bookId],
	);

	const incrementViews = useCallback(
		async (bookId: string) => {
			try {
				await supabase.rpc("increment_views", { book_id: bookId });
			} catch (error) {
				console.error("Error incrementing views:", error);
			}
		},
		[supabase],
	);

	// Состояние для серии
	const [seriesBooks, setSeriesBooks] = useState<
		{ id: string; title: string; series_order?: number }[]
	>([]);

	// Helper to fetch history
	const getHistory = async (uId: string, bId: string) => {
		const { data } = await supabase
			.from("reading_history")
			.select("*")
			.match({ user_id: uId, book_id: bId })
			.maybeSingle();
		return data;
	};

	// Загрузка данных
	useEffect(() => {
		const initData = async () => {
			try {
				// 1. Session & Profile
				const session = await getValidSession(supabase);
				const authUser = session?.user;
				setUser(authUser || null);

				if (authUser) {
					supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.maybeSingle()
						.then(({ data: profile }) => {
							if (profile) setUserProfile(profile as UserProfile);
						})
						.catch(() => {});
				}

				if (!bookId) {
					router.push("/library");
					return;
				}

				const { data: bookData, error: bookError } = await supabase
					.from("books")
					.select("*")
					.eq("id", bookId)
					.single();

				if (bookError) {
					console.error("Error loading book:", bookError);
					router.push("/library");
					return;
				}

				setBook(bookData);

				// Fetch History
				let historyData: any = null;
				if (authUser) {
					historyData = await getHistory(authUser.id, bookId);
					if (historyData?.last_position) {
						scrollTargetRef.current = historyData.last_position;
					}
				}

				// 3. Series Data - Independent Promise
				if (bookData.series_id) {
					supabase
						.from("books")
						.select("id, title, series_order")
						.eq("series_id", bookData.series_id)
						.order("series_order", { ascending: true })
						.then(({ data }) => {
							if (data) setSeriesBooks(data);
						});
				}

				// 4. Content
				if (bookData.file_format === "zip") {
					await loadZipContent(historyData?.current_file);
				} else {
					await loadFileContent();
				}

				// 5. Views
				await incrementViews(bookId);
			} catch (error) {
				console.error("Error initializing data:", error);
			} finally {
				setLoading(false);
			}
		};

		initData();
	}, [
		bookId,
		supabase,
		router,
		loadFileContent,
		loadZipContent,
		incrementViews,
	]);

	const handleFileSelect = (fileName: string) => {
		const file = files.find((f) => f.name === fileName);
		if (file) {
			setSelectedFile(fileName);
			setContent(file.content);
			setShowFileSelector(false);
		}
	};

	const increaseFontSize = () => setFontSize((prev) => Math.min(prev + 2, 32));
	const decreaseFontSize = () => setFontSize((prev) => Math.max(prev - 2, 12));

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/auth/login");
	};

	const handleDownload = async () => {
		if (book?.file_url && book?.id) {
			try {
				const response = await fetch(`/api/download/${book.id}`);
				if (!response.ok)
					throw new Error(`Failed to download: ${response.statusText}`);

				const parseContentDisposition = (
					contentDisposition: string | null,
				): string | null => {
					if (!contentDisposition) return null;
					const filenameStarMatch =
						contentDisposition.match(/filename\*=([^;]+)/i);
					if (filenameStarMatch) {
						const value = filenameStarMatch[1].trim();
						const parts = value.split("''");
						if (parts.length === 2) {
							try {
								return decodeURIComponent(parts[1]);
							} catch (e) {
								console.warn("Failed to decode filename*:", e);
							}
						}
					}
					const filenameMatch = contentDisposition.match(/filename=([^;]+)/i);
					if (filenameMatch) {
						let value = filenameMatch[1].trim();
						if (
							(value.startsWith('"') && value.endsWith('"')) ||
							(value.startsWith("'") && value.endsWith("'"))
						) {
							value = value.slice(1, -1);
						}
						try {
							return decodeURIComponent(value);
						} catch {
							return value;
						}
					}
					return null;
				};

				const contentDisposition = response.headers.get("Content-Disposition");
				let filename = parseContentDisposition(contentDisposition);
				if (!filename) filename = `${book.id}.${book.file_format || "fb2"}`;

				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			} catch (error) {
				console.error("Error downloading file:", error);
				if (book.file_url) window.open(book.file_url, "_blank");
			}
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<BookOpen className="h-12 w-12 mx-auto animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка читалки...</p>
				</div>
			</div>
		);
	}

	if (!book) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<p className="text-muted-foreground">Книга не найдена</p>
					<Button onClick={() => router.push("/library")}>
						Вернуться в библиотеку
					</Button>
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

				<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
					{/* Mobile Header */}
					<header className="lg:hidden flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-xl sticky top-0 z-30">
						<div className="flex items-center gap-2">
							<BookOpen className="h-6 w-6 text-primary" />
							<span className="font-bold text-lg truncate max-w-[200px]">
								{book.title}
							</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setMobileMenuOpen(true)}
						>
							<Menu className="h-6 w-6" />
						</Button>
					</header>

					{/* Reader Content Area */}
					<div className="flex-1 flex flex-col overflow-hidden relative bg-background">
						{/* Reader Toolbar (Sticky) */}
						<div className="flex items-center justify-between p-3 md:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 shadow-sm">
							<div className="flex items-center gap-3 overflow-hidden">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => router.push("/library")}
									className="shrink-0 hover:bg-primary/10"
								>
									<ChevronLeft className="h-5 w-5" />
								</Button>
								<div className="min-w-0 hidden sm:block">
									<h1 className="text-sm font-bold truncate text-foreground">
										{book.title}
									</h1>
									<p className="text-xs text-muted-foreground truncate">
										{book.author}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-1 sm:gap-2 shrink-0">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="hover:bg-primary/10"
										>
											<Type className="h-5 w-5" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-48">
										<div className="flex items-center justify-between p-2">
											<Button
												variant="outline"
												size="icon"
												onClick={decreaseFontSize}
												className="h-8 w-8"
											>
												<span className="text-xs">A-</span>
											</Button>
											<span className="text-sm font-medium">{fontSize}px</span>
											<Button
												variant="outline"
												size="icon"
												onClick={increaseFontSize}
												className="h-8 w-8"
											>
												<span className="text-sm">A+</span>
											</Button>
										</div>
									</DropdownMenuContent>
								</DropdownMenu>

								{(files.length > 1 || seriesBooks.length > 0) && (
									<Button
										variant={showFileSelector ? "secondary" : "ghost"}
										size="icon"
										onClick={() => setShowFileSelector(!showFileSelector)}
										className="hover:bg-primary/10"
									>
										<List className="h-5 w-5" />
									</Button>
								)}

								{book.file_url && (
									<Button
										variant="ghost"
										size="icon"
										onClick={handleDownload}
										className="hover:bg-primary/10"
									>
										<Download className="h-5 w-5" />
									</Button>
								)}
							</div>
						</div>

						{/* Content Selector Overlay */}
						{showFileSelector && (
							<div className="absolute top-16 right-4 w-auto min-w-80 max-w-[min(90vw,600px)] bg-card/95 backdrop-blur-xl border shadow-2xl rounded-xl z-30 max-h-[calc(100%-6rem)] overflow-y-auto animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col">
								<div className="p-3 border-b bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
									<span className="font-semibold text-sm">Содержание</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => setShowFileSelector(false)}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>

								<div className="p-2 space-y-4">
									{/* Files Section */}
									{files.length > 1 && (
										<div className="space-y-1">
											<h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												Файлы
											</h3>
											{files.map((file) => (
												<Button
													key={file.name}
													variant={
														selectedFile === file.name ? "secondary" : "ghost"
													}
													className="justify-start h-auto py-2 px-3 text-sm w-full font-normal whitespace-nowrap"
													onClick={() => handleFileSelect(file.name)}
												>
													{file.name}
												</Button>
											))}
										</div>
									)}

									{files.length > 1 && seriesBooks.length > 0 && (
										<div className="h-px bg-border mx-2" />
									)}

									{/* Series Section */}
									{seriesBooks.length > 0 && (
										<div className="space-y-1">
											<h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
												Серия
											</h3>
											{seriesBooks.map((sBook) => (
												<Button
													key={sBook.id}
													variant={book.id === sBook.id ? "secondary" : "ghost"}
													className={cn(
														"justify-start text-left h-auto py-2 px-3 text-sm w-full font-normal whitespace-nowrap",
														book.id === sBook.id &&
															"bg-primary/10 text-primary hover:bg-primary/20",
													)}
													onClick={() => {
														if (book.id !== sBook.id) {
															router.push(`/reader?bookId=${sBook.id}`);
															setShowFileSelector(false);
														}
													}}
												>
													<span className="mr-2 text-muted-foreground opacity-70 w-4 text-right inline-block shrink-0">
														{sBook.series_order || "-"}
													</span>
													<span>{sBook.title}</span>
												</Button>
											))}
										</div>
									)}
								</div>
							</div>
						)}

						{/* Text Content */}
						<div
							ref={scrollRef}
							onScroll={handleScroll}
							className="flex-1 overflow-y-auto p-4 md:p-8 lg:px-16 scrollbar-hide relative"
						>
							{content ? (
								<div
									className="prose prose-zinc dark:prose-invert max-w-none container mx-auto px-4 md:px-12 lg:px-20 leading-relaxed transition-all duration-200 text-justify hyphens-auto pb-20"
									style={{ fontSize: `${fontSize}px` }}
									dangerouslySetInnerHTML={{
										__html: DOMPurify.sanitize(content, {
											ALLOWED_TAGS: [
												"p",
												"br",
												"h3",
												"h4",
												"div",
												"strong",
												"em",
												"i",
												"b",
											],
											ALLOWED_ATTR: ["class"],
										}),
									}}
								/>
							) : (
								<div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
									<BookOpen className="h-16 w-16" />
									<p className="text-lg font-medium">
										Выберите файл для чтения
									</p>
								</div>
							)}
						</div>

						{/* Progress Footer */}
						{book && (
							<div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 px-4 flex flex-col gap-2 z-20 absolute bottom-0 left-0 right-0">
								<div className="flex items-center gap-4">
									<span className="text-xs text-muted-foreground w-12 text-right">
										{Math.round(progress)}%
									</span>
									<input
										type="range"
										min="0"
										max="100"
										step="0.1"
										value={progress}
										onChange={handleProgressChange}
										className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
									/>
									<span className="text-xs font-variant-numeric tabular-nums w-20 text-right text-muted-foreground">
										{currentPage} / {totalPages}
									</span>
								</div>
								{chapters.length > 0 && (
									<div className="flex justify-between items-center px-1">
										<Button
											variant="ghost"
											size="sm"
											disabled={currentChapterIndex <= 0}
											onClick={() => scrollToChapter(currentChapterIndex - 1)}
											className="h-6 text-xs text-muted-foreground"
										>
											Пред. глава
										</Button>
										<span className="text-xs text-muted-foreground truncate max-w-[200px]">
											{chapters[currentChapterIndex]?.title}
										</span>
										<Button
											variant="ghost"
											size="sm"
											disabled={currentChapterIndex >= chapters.length - 1}
											onClick={() => scrollToChapter(currentChapterIndex + 1)}
											className="h-6 text-xs text-muted-foreground"
										>
											След. глава
										</Button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Mobile Menu Overlay */}
				{mobileMenuOpen && (
					<div className="fixed inset-0 z-50 lg:hidden bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
						<div className="fixed inset-y-0 left-0 w-72 bg-card border-r shadow-2xl p-0 flex flex-col animate-in slide-in-from-left duration-300">
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
						<div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
					</div>
				)}
			</div>
		</PageTransition>
	);
}

export default function ReaderPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-background">
					<div className="text-center space-y-4">
						<BookOpen className="h-12 w-12 mx-auto animate-pulse text-primary" />
						<p className="text-muted-foreground">Загрузка...</p>
					</div>
				</div>
			}
		>
			<ReaderContent />
		</Suspense>
	);
}
