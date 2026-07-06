"use client";

import {
	ArrowRight,
	CheckCircle2,
	FileSearch,
	Link2,
	Loader2,
	RefreshCw,
	Search,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BookWithoutFile {
	id: string;
	title: string;
	author: string;
	telegram_post_id: number | null;
}

interface FileMatch {
	message_id: number;
	filename: string;
	score: number;
	matchedWords: string[];
	titleMatchCount: number;
	authorMatch: boolean;
	fileAuthorParsed?: string;
	fileTitleParsed?: string;
}

export function FileLinkingView() {
	const [books, setBooks] = useState<BookWithoutFile[]>([]);
	const [booksLoading, setBooksLoading] = useState(true);
	const [selectedBook, setSelectedBook] = useState<BookWithoutFile | null>(
		null,
	);
	const [matches, setMatches] = useState<FileMatch[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [linking, setLinking] = useState<string | null>(null);
	const [linkResult, setLinkResult] = useState<{
		bookId: string;
		success: boolean;
		error?: string;
	} | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const fetchBooks = useCallback(async () => {
		setBooksLoading(true);
		try {
			const res = await fetch("/api/admin/file-linking/books");
			const data = await res.json();
			if (!data.error) setBooks(data.books || []);
		} catch {
			// The admin page can still render while the API reports errors elsewhere.
		} finally {
			setBooksLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchBooks();
	}, [fetchBooks]);

	const searchMatches = async (book: BookWithoutFile) => {
		setSelectedBook(book);
		setSearching(true);
		setMatches(null);
		setLinkResult(null);
		try {
			const res = await fetch("/api/admin/file-linking/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: book.title,
					author: book.author,
					limit: 10,
				}),
			});
			const data = await res.json();
			if (!data.error) setMatches(data.matches || []);
		} catch {
			// Search failures are surfaced by an empty state so the operator can retry.
		} finally {
			setSearching(false);
		}
	};

	const linkFile = async (messageId: number) => {
		if (!selectedBook) return;
		setLinking(String(messageId));
		try {
			const res = await fetch("/api/admin/file-linking/link", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ bookId: selectedBook.id, messageId }),
			});
			const data = await res.json();
			if (!data.error) {
				setLinkResult({ bookId: selectedBook.id, success: true });
				setBooks((prev) => prev.filter((book) => book.id !== selectedBook.id));
			} else {
				setLinkResult({
					bookId: selectedBook.id,
					success: false,
					error: data.error,
				});
			}
		} catch {
			setLinkResult({
				bookId: selectedBook.id,
				success: false,
				error: "Не удалось привязать файл",
			});
		} finally {
			setLinking(null);
		}
	};

	const formatAuthorTitle = (author: string, title: string) =>
		`${author} — ${title}`;

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredBooks = books.filter((book) => {
		if (!normalizedQuery) return true;
		return (
			book.title.toLowerCase().includes(normalizedQuery) ||
			book.author.toLowerCase().includes(normalizedQuery)
		);
	});

	const bestScore = matches?.[0]?.score ?? null;

	return (
		<div className="mx-auto grid h-full min-h-[calc(100vh-245px)] w-full max-w-[1320px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[390px_minmax(0,1fr)] lg:px-8">
			<aside className="flex min-h-[520px] flex-col rounded-lg border bg-card shadow-sm">
				<div className="border-b p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 space-y-1">
							<p className="font-medium text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
								Очередь
							</p>
							<h3 className="font-semibold text-base">Книги без файлов</h3>
							<p className="text-muted-foreground text-xs">
								{filteredBooks.length} из {books.length} в текущем фильтре
							</p>
						</div>
						<Button
							size="icon"
							variant="outline"
							className="size-8 shrink-0"
							onClick={fetchBooks}
							disabled={booksLoading}
							aria-label="Обновить список книг"
						>
							<RefreshCw
								className={`size-3.5 ${booksLoading ? "animate-spin" : ""}`}
							/>
						</Button>
					</div>

					<div className="relative mt-4">
						<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Автор или название"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							className="h-9 pl-8 text-sm"
						/>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{booksLoading ? (
						<div className="flex h-full min-h-64 items-center justify-center">
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Loader2 className="size-4 animate-spin" />
								Загружаю очередь
							</div>
						</div>
					) : filteredBooks.length === 0 ? (
						<div className="flex h-full min-h-64 items-center justify-center p-8 text-center">
							<div className="space-y-2">
								<FileSearch className="mx-auto size-8 text-muted-foreground/45" />
								<p className="font-medium text-sm">
									{books.length === 0
										? "У всех книг есть файлы"
										: "Ничего не найдено"}
								</p>
								<p className="text-muted-foreground text-xs">
									Попробуйте другой запрос или обновите очередь.
								</p>
							</div>
						</div>
					) : (
						<div className="divide-y">
							{filteredBooks.map((book) => (
								<button
									key={book.id}
									type="button"
									onClick={() => searchMatches(book)}
									className={`w-full px-4 py-3 text-left transition-colors ${
										selectedBook?.id === book.id
											? "bg-accent text-accent-foreground"
											: "hover:bg-muted/70"
									}`}
								>
									<p className="truncate font-medium text-sm leading-tight">
										{book.title}
									</p>
									<div className="mt-1 flex min-w-0 items-center justify-between gap-3">
										<p className="truncate text-muted-foreground text-xs">
											{book.author}
										</p>
										{book.telegram_post_id ? (
											<Badge variant="outline" className="h-5 shrink-0 px-1.5">
												#{book.telegram_post_id}
											</Badge>
										) : null}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</aside>

			<section className="min-h-[520px] rounded-lg border bg-card shadow-sm">
				{!selectedBook ? (
					<div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center">
						<div className="max-w-sm space-y-3">
							<div className="mx-auto flex size-12 items-center justify-center rounded-lg border bg-muted">
								<Link2 className="size-5 text-muted-foreground" />
							</div>
							<div>
								<h3 className="font-semibold text-base">Выберите книгу</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									После выбора справа появятся кандидаты из Telegram и детали
									оценки совпадения.
								</p>
							</div>
						</div>
					</div>
				) : (
					<div className="flex h-full min-h-[520px] flex-col">
						<div className="border-b p-4">
							<div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
										Выбранная книга
									</p>
									<h3 className="break-words font-semibold text-lg leading-tight">
										{selectedBook.title}
									</h3>
									<p className="text-muted-foreground text-sm">
										{selectedBook.author}
									</p>
								</div>
								<div className="flex gap-2 md:justify-end">
									<Badge variant="secondary">
										{searching ? "Поиск" : `${matches?.length ?? 0} кандидатов`}
									</Badge>
									{bestScore !== null ? (
										<Badge variant="outline">Лучший score: {bestScore}</Badge>
									) : null}
								</div>
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
							{searching ? (
								<div className="flex h-full min-h-80 items-center justify-center">
									<div className="flex items-center gap-2 text-muted-foreground text-sm">
										<Loader2 className="size-4 animate-spin" />
										Ищу подходящие файлы
									</div>
								</div>
							) : !matches || matches.length === 0 ? (
								<div className="flex h-full min-h-80 items-center justify-center text-center">
									<div className="max-w-sm space-y-2">
										<XCircle className="mx-auto size-8 text-muted-foreground/45" />
										<h3 className="font-semibold text-sm">Кандидатов нет</h3>
										<p className="text-muted-foreground text-xs">
											Алгоритм не нашел файлов выше текущего порога совпадения.
										</p>
									</div>
								</div>
							) : (
								<div className="mx-auto max-w-3xl space-y-3">
									<div className="flex items-center justify-between gap-3">
										<p className="font-medium text-muted-foreground text-[11px] uppercase tracking-[0.16em]">
											Кандидаты Telegram
										</p>
										<p className="text-muted-foreground text-xs">
											Сначала показаны самые вероятные совпадения
										</p>
									</div>

									{matches.map((match) => {
										const displayAuthor = match.fileAuthorParsed || "";
										const displayTitle =
											match.fileTitleParsed || match.filename;
										const scoreTone =
											match.score >= 60
												? "text-emerald-700 dark:text-emerald-400"
												: match.score >= 40
													? "text-amber-700 dark:text-amber-400"
													: "text-destructive";
										const scoreTrack =
											match.score >= 60
												? "bg-emerald-500"
												: match.score >= 40
													? "bg-amber-500"
													: "bg-destructive";

										return (
											<Card key={match.message_id} className="overflow-hidden">
												<CardContent className="p-0">
													<div className="grid gap-0 md:grid-cols-[88px_minmax(0,1fr)_auto]">
														<div className="border-b bg-muted/50 p-3 md:border-b-0 md:border-r">
															<p
																className={`font-mono font-semibold text-lg ${scoreTone}`}
															>
																{match.score}
															</p>
															<p className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
																score
															</p>
															<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
																<div
																	className={`h-full ${scoreTrack}`}
																	style={{
																		width: `${Math.min(100, Math.max(0, match.score))}%`,
																	}}
																/>
															</div>
														</div>

														<div className="min-w-0 space-y-2 p-3">
															<p className="break-words font-medium text-sm leading-tight">
																{match.fileAuthorParsed
																	? formatAuthorTitle(
																			match.fileAuthorParsed,
																			displayTitle,
																		)
																	: match.filename}
															</p>
															<div className="flex flex-wrap gap-1.5">
																<Badge
																	variant={
																		match.authorMatch ? "secondary" : "outline"
																	}
																	className="h-5"
																>
																	{match.authorMatch
																		? "Автор совпал"
																		: displayAuthor
																			? `Автор: ${displayAuthor}`
																			: "Автор не выделен"}
																</Badge>
																<Badge variant="outline" className="h-5">
																	title: {match.titleMatchCount}
																</Badge>
																<Badge variant="outline" className="h-5">
																	msg {match.message_id}
																</Badge>
															</div>
															{match.matchedWords.length > 0 ? (
																<p className="text-muted-foreground text-xs">
																	Совпавшие слова:{" "}
																	{match.matchedWords.join(", ")}
																</p>
															) : null}

															{linkResult &&
															linkResult.bookId === selectedBook.id ? (
																<div
																	className={`flex items-center gap-1.5 rounded-md border p-2 text-xs ${
																		linkResult.success
																			? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
																			: "border-destructive/25 bg-destructive/10 text-destructive"
																	}`}
																>
																	{linkResult.success ? (
																		<CheckCircle2 className="size-3.5 shrink-0" />
																	) : (
																		<XCircle className="size-3.5 shrink-0" />
																	)}
																	{linkResult.success
																		? "Файл привязан"
																		: linkResult.error}
																</div>
															) : null}
														</div>

														<div className="flex items-center border-t p-3 md:border-l md:border-t-0">
															<Button
																size="sm"
																variant={
																	match.score >= 60 ? "default" : "outline"
																}
																className="w-full gap-1.5 md:w-auto"
																onClick={() => linkFile(match.message_id)}
																disabled={linking === String(match.message_id)}
															>
																{linking === String(match.message_id) ? (
																	<Loader2 className="size-3.5 animate-spin" />
																) : (
																	<ArrowRight className="size-3.5" />
																)}
																Привязать
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
