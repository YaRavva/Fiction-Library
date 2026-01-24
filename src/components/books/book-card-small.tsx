"use client";

import { motion } from "framer-motion";
import { BookOpen, Download, MoreHorizontal, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Book as SupabaseBook } from "@/lib/supabase";

// Extend SupabaseBook to include rating if it's missing in the type but present in DB or logic
interface Book extends SupabaseBook {
	rating?: number;
	series?: {
		title: string;
	};
}

interface BookCardProps {
	book: Book;
	index?: number;
	onDownload?: (book: Book) => void;
	onRead?: (book: Book) => void;
	onDelete?: (book: Book) => void;
	onTagClick?: (tag: string) => void;
	onAuthorClick?: (author: string) => void;
	onBookClick?: (book: Book) => void;
	isAdmin?: boolean;
}

export function BookCard({
	book,
	index = 0,
	onDownload,
	onRead,
	onDelete,
	onTagClick,
	onAuthorClick,
	onBookClick,
	isAdmin,
}: BookCardProps) {
	// Determine format badge color
	const getFormatColor = (format: string) => {
		switch (format?.toLowerCase()) {
			case "pdf":
				return "bg-red-500/10 text-red-500 border-red-500/20";
			case "epub":
				return "bg-green-500/10 text-green-500 border-green-500/20";
			case "fb2":
				return "bg-blue-500/10 text-blue-500 border-blue-500/20";
			default:
				return "bg-primary/5 text-primary border-primary/20";
		}
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.9 }}
			transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
			whileHover={{ y: -5 }}
			className={`group relative w-full h-full ${onBookClick ? "cursor-pointer" : ""}`}
			onClick={() => onBookClick?.(book)}
		>
			<div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500/20 to-violet-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />

			<div className="relative h-full flex flex-col bg-card/50 backdrop-blur-sm border border-white/10 dark:border-white/5 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300">
				{/* Cover Section */}
				<div className="relative aspect-[2/3] w-full overflow-hidden bg-muted/30">
					{book.cover_url ? (
						<Image
							src={book.cover_url}
							alt={book.title}
							fill
							className="object-cover transition-transform duration-500 group-hover:scale-105"
							sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
							<BookOpen className="w-12 h-12 text-muted-foreground/30" />
						</div>
					)}

					{/* Rating Badge */}
					{book.rating && book.rating > 0 && (
						<div className="absolute top-3 right-3">
							<div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
								<Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
								<span>{book.rating}</span>
							</div>
						</div>
					)}

					{/* Overlay Actions */}
					<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
						{onRead && (
							<Button
								size="icon"
								variant="secondary"
								onClick={(e) => {
									e.stopPropagation();
									onRead(book);
								}}
								className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-black shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75"
								title="Читать"
							>
								<BookOpen className="w-4 h-4" />
							</Button>
						)}
						<Button
							size="icon"
							variant="secondary"
							className="rounded-full w-10 h-10 bg-white/90 hover:bg-white text-black shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-100"
							title="Скачать"
							asChild
							onClick={(e) => e.stopPropagation()}
						>
							<a href={`/api/download/${book.id}`} download>
								<Download className="w-4 h-4" />
							</a>
						</Button>
					</div>
				</div>

				{/* Info Section */}
				<div className="flex-1 p-4 flex flex-col gap-2">
					<div className="flex items-start justify-between gap-2">
						<div>
							<h3
								className="font-semibold text-base leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors"
								title={book.title}
							>
								{book.title}
							</h3>
							<p
								className={`text-sm text-muted-foreground line-clamp-1 ${onAuthorClick ? "cursor-pointer hover:text-primary hover:underline transition-all" : ""}`}
								title={book.author}
								onClick={(e) => {
									if (onAuthorClick) {
										e.stopPropagation();
										onAuthorClick(book.author);
									}
								}}
							>
								{book.author}
							</p>
						</div>
					</div>

					<div className="mt-auto pt-3 flex items-center justify-between gap-2">
						<div className="flex flex-wrap gap-1">
							{book.genres?.slice(0, 1).map((genre) => (
								<Badge
									key={genre}
									variant="outline"
									className="text-[10px] px-1.5 py-0 h-5 bg-secondary/30 text-secondary-foreground border-secondary/20"
								>
									{genre}
								</Badge>
							))}
							{book.file_format && (
								<Badge
									variant="outline"
									className={`text-[10px] px-1.5 py-0 h-5 ${getFormatColor(book.file_format)}`}
								>
									{book.file_format}
								</Badge>
							)}
							{book.publication_year && (
								<Badge
									variant="outline"
									className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground"
								>
									{book.publication_year}
								</Badge>
							)}
							{book.tags?.slice(0, 2).map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className={`text-[10px] px-1.5 py-0 h-5 ${onTagClick ? "cursor-pointer hover:bg-primary/20" : ""}`}
									onClick={(e) => {
										if (onTagClick) {
											e.stopPropagation();
											onTagClick(tag);
										}
									}}
								>
									#{tag}
								</Badge>
							))}
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground"
									onClick={(e) => e.stopPropagation()}
								>
									<MoreHorizontal className="w-4 h-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{onRead && (
									<DropdownMenuItem onClick={() => onRead(book)}>
										<BookOpen className="mr-2 h-4 w-4" /> Читать
									</DropdownMenuItem>
								)}
								{onDownload && (
									<DropdownMenuItem onClick={() => onDownload(book)}>
										<Download className="mr-2 h-4 w-4" /> Скачать
									</DropdownMenuItem>
								)}
								{isAdmin && onDelete && (
									<DropdownMenuItem
										onClick={() => onDelete(book)}
										className="text-destructive focus:text-destructive"
									>
										<Trash2 className="mr-2 h-4 w-4" /> Удалить
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
