"use client";

import { BookOpen, FileCheck2, Star } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Book {
	id: string;
	title: string;
	author: string;
	rating?: number;
	year?: number;
	publication_year?: number;
	format?: string;
	file_format?: string;
	file_url?: string | null;
	coverUrl?: string;
	cover_url?: string;
	genres?: string[];
}

interface ModernBookCardProps {
	book: Book;
	index?: number;
}

export function ModernBookCard({ book }: ModernBookCardProps) {
	const cover = book.coverUrl || book.cover_url;
	const format = book.format || book.file_format;
	const year = book.year || book.publication_year;
	const genres = book.genres || [];

	return (
		<article className="group h-full overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
			<div className="relative aspect-[2/3] overflow-hidden bg-muted">
				{cover ? (
					<Image
						src={cover}
						alt={book.title}
						fill
						className="object-cover transition-transform duration-300 group-hover:scale-[1.035]"
						sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 180px"
						unoptimized
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-secondary">
						<BookOpen className="size-10 text-muted-foreground/40" />
					</div>
				)}

				<div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
					{book.rating ? (
						<span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-1 font-semibold text-xs shadow-sm backdrop-blur">
							<Star className="size-3 fill-amber-500 text-amber-500" />
							{book.rating.toFixed(1)}
						</span>
					) : (
						<span />
					)}
					{book.file_url ? (
						<span className="inline-flex items-center rounded-md bg-background/90 px-1.5 py-1 text-emerald-700 shadow-sm backdrop-blur dark:text-emerald-300">
							<FileCheck2 className="size-3.5" />
						</span>
					) : null}
				</div>
			</div>

			<div className="space-y-3 p-3">
				<div className="min-w-0 space-y-1">
					<h3 className="line-clamp-2 font-semibold text-sm leading-snug tracking-tight">
						{book.title}
					</h3>
					<p className="line-clamp-1 text-muted-foreground text-xs">
						{book.author}
					</p>
				</div>

				<div className="flex min-h-6 flex-wrap items-center gap-1.5">
					{genres.slice(0, 1).map((genre) => (
						<Badge key={genre} variant="secondary" className="text-[10px]">
							{genre}
						</Badge>
					))}
					{format ? (
						<Badge
							variant="outline"
							className={cn(
								"text-[10px] uppercase",
								format.toLowerCase() === "fb2" &&
									"border-blue-500/20 text-blue-700 dark:text-blue-300",
								format.toLowerCase() === "pdf" &&
									"border-red-500/20 text-red-700 dark:text-red-300",
							)}
						>
							{format}
						</Badge>
					) : null}
					{year ? (
						<span className="ml-auto text-muted-foreground text-[11px] tabular-nums">
							{year}
						</span>
					) : null}
				</div>
			</div>
		</article>
	);
}
