import {
	BookOpen,
	Calendar,
	Download,
	FileCheck2,
	FileX2,
	Star,
	Trash2,
	UserRound,
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Book } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface BookCardLargeProps {
	book: Book & {
		rating?: number;
		series?: {
			id: string;
			title: string;
			author: string;
			series_composition?: { title: string; year: number }[];
			cover_urls?: string[];
		};
	};
	onDownload: (book: Book) => void;
	onRead: (book: Book) => void;
	onBookClick?: (book: Book) => void;
	onTagClick?: (tag: string) => void;
	userProfile?: {
		id: string;
		role: string;
	} | null;
	onFileClear?: (bookId: string) => void;
	onAuthorClick?: (author: string) => void;
}

function formatFileSize(size?: number | null) {
	if (!size) return null;
	if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
	return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

export function BookCardLarge({
	book,
	onDownload,
	onRead,
	onBookClick,
	onTagClick,
	userProfile,
	onFileClear,
	onAuthorClick,
}: BookCardLargeProps) {
	const hasFile = Boolean(book.file_url);
	const fileSize = formatFileSize(book.file_size);
	const visibleGenres = book.genres?.slice(0, 4) || [];
	const canClearFile =
		hasFile &&
		(userProfile?.role === "admin" || process.env.NODE_ENV === "development");

	const handleOpen = () => {
		onBookClick?.(book);
	};

	const clearFile = () => {
		if (
			onFileClear &&
			window.confirm(`Очистить файл для книги "${book.title}"?`)
		) {
			onFileClear(book.id);
		}
	};

	return (
		<article
			className={cn(
				"group grid gap-4 rounded-lg border bg-card p-3 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:grid-cols-[112px_1fr] sm:p-4",
				onBookClick && "cursor-pointer",
			)}
			onClick={handleOpen}
		>
			<div className="relative mx-auto aspect-[2/3] w-28 overflow-hidden rounded-md border bg-muted shadow-sm sm:mx-0 sm:w-full">
				{book.cover_url ? (
					<Image
						src={book.cover_url}
						alt={book.title}
						fill
						className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
						sizes="112px"
						unoptimized
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-secondary">
						<BookOpen className="size-9 text-muted-foreground/45" />
					</div>
				)}
			</div>

			<div className="min-w-0 space-y-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							{book.rating ? (
								<Badge
									variant="outline"
									className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
								>
									<Star className="size-3 fill-current" />
									{book.rating.toFixed(1)}
								</Badge>
							) : null}
							<Badge
								variant="outline"
								className={cn(
									"gap-1",
									hasFile
										? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
										: "border-muted-foreground/20 text-muted-foreground",
								)}
							>
								{hasFile ? (
									<FileCheck2 className="size-3" />
								) : (
									<FileX2 className="size-3" />
								)}
								{hasFile ? "Файл доступен" : "Нет файла"}
							</Badge>
							{book.file_format ? (
								<Badge variant="secondary">{book.file_format}</Badge>
							) : null}
						</div>

						<h2 className="line-clamp-2 font-semibold text-[17px] leading-snug tracking-tight sm:text-xl">
							{book.title}
						</h2>

						<button
							type="button"
							className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
							onClick={(event) => {
								event.stopPropagation();
								onAuthorClick?.(book.author);
							}}
						>
							<UserRound className="size-3.5 shrink-0" />
							<span className="truncate">{book.author}</span>
						</button>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										size="icon"
										variant="outline"
										disabled={!hasFile}
										onClick={(event) => {
											event.stopPropagation();
											onRead(book);
										}}
									>
										<BookOpen className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Читать</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										size="icon"
										variant="outline"
										disabled={!hasFile}
										onClick={(event) => {
											event.stopPropagation();
											onDownload(book);
										}}
									>
										<Download className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Скачать</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{canClearFile ? (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											size="icon"
											variant="ghost"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											onClick={(event) => {
												event.stopPropagation();
												clearFile();
											}}
										>
											<Trash2 className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Очистить файл</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : null}
					</div>
				</div>

				{book.description ? (
					<p className="line-clamp-3 text-muted-foreground text-sm leading-6">
						{book.description}
					</p>
				) : null}

				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs">
					{book.publication_year ? (
						<span className="inline-flex items-center gap-1">
							<Calendar className="size-3.5" />
							{book.publication_year}
						</span>
					) : null}
					{book.series?.title ? <span>Серия: {book.series.title}</span> : null}
					{fileSize ? <span>{fileSize}</span> : null}
					{book.downloads_count ? (
						<span>{book.downloads_count} скач.</span>
					) : null}
					{book.views_count ? <span>{book.views_count} просмотров</span> : null}
				</div>

				{visibleGenres.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{visibleGenres.map((genre) => (
							<Badge
								key={`${book.id}-${genre}`}
								variant="outline"
								className="cursor-pointer bg-background/60 text-xs hover:bg-accent"
								onClick={(event) => {
									event.stopPropagation();
									onTagClick?.(genre);
								}}
							>
								{genre}
							</Badge>
						))}
						{book.genres && book.genres.length > visibleGenres.length ? (
							<Badge variant="secondary">
								+{book.genres.length - visibleGenres.length}
							</Badge>
						) : null}
					</div>
				) : null}
			</div>
		</article>
	);
}
