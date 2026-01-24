"use client";

import { motion } from "framer-motion";
import { BookOpen, Download, Star } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Book {
	id: string;
	title: string;
	author: string;
	rating?: number;
	year?: number;
	format?: string;
	file_format?: string;
	coverUrl?: string;
	cover_url?: string;
	genres?: string[];
	tags?: string[];
}

interface ModernBookCardProps {
	book: Book;
	index?: number;
}

export function ModernBookCard({ book, index = 0 }: ModernBookCardProps) {
	const cover = book.coverUrl || book.cover_url;
	const format = book.format || book.file_format;
	const genres = book.genres || [];

	const getFormatColor = (fmt: string) => {
		switch (fmt?.toLowerCase()) {
			case "pdf":
				return "bg-red-500/10 text-red-500 border-red-500/10";
			case "epub":
				return "bg-emerald-500/10 text-emerald-500 border-emerald-500/10";
			case "fb2":
				return "bg-blue-500/10 text-blue-500 border-blue-500/10";
			default:
				return "bg-primary/5 text-primary border-primary/10";
		}
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 15 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.4,
				ease: "easeOut",
				delay: Math.min(index * 0.05, 0.5),
			}}
			whileHover={{ y: -8, scale: 1.01 }}
			className="group relative w-full h-full"
		>
			{/* Ambient Glow */}
			<div className="absolute -inset-2 bg-gradient-to-b from-primary/10 to-transparent rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />

			<div className="relative h-full flex flex-col bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-500">
				{/* Cover Section */}
				<div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
					{cover ? (
						<Image
							src={cover}
							alt={book.title}
							fill
							className="object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
							sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
							<BookOpen className="w-12 h-12 text-muted-foreground/20" />
						</div>
					)}

					{/* Gradient Overlay */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

					{/* Rating Badge */}
					{book.rating && book.rating > 0 && (
						<div className="absolute top-3 right-3 z-10">
							<div className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-xs font-semibold shadow-sm">
								<Star className="w-3 h-3 fill-amber-400 text-amber-400" />
								<span>{book.rating}</span>
							</div>
						</div>
					)}

					{/* Quick Actions (Slide Up) */}
					<div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
						<div className="flex gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
							<a href={`/reader?bookId=${book.id}`} className="no-underline">
								<Button
									size="icon"
									className="rounded-full w-12 h-12 bg-white/90 hover:bg-white text-black shadow-xl border-0 hover:scale-110 transition-all duration-300"
									title="Читать"
								>
									<BookOpen className="w-5 h-5" />
								</Button>
							</a>
							<a
								href={`/api/download/${book.id}`}
								download
								className="no-underline"
							>
								<Button
									size="icon"
									className="rounded-full w-12 h-12 bg-white/90 hover:bg-white text-black shadow-xl border-0 hover:scale-110 transition-all duration-300 delay-75"
									title="Скачать"
								>
									<Download className="w-5 h-5" />
								</Button>
							</a>
						</div>
					</div>
				</div>

				{/* Info Section */}
				<div className="flex-1 p-5 flex flex-col gap-3">
					<div className="space-y-1">
						<h3
							className="font-bold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-300"
							title={book.title}
						>
							{book.title}
						</h3>
						<p
							className="text-sm text-muted-foreground font-medium line-clamp-1"
							title={book.author}
						>
							{book.author}
						</p>
					</div>

					<div className="mt-auto pt-2 flex items-center justify-between gap-2">
						<div className="flex flex-wrap gap-2">
							{genres.slice(0, 1).map((genre) => (
								<Badge
									key={genre}
									variant="secondary"
									className="text-[10px] px-2 py-0.5 h-6 bg-secondary/50 hover:bg-secondary/70 border-0 font-medium transition-colors"
								>
									{genre}
								</Badge>
							))}
							{format && (
								<Badge
									variant="outline"
									className={`text-[10px] px-2 py-0.5 h-6 border font-semibold ${getFormatColor(
										format,
									)}`}
								>
									{format.toUpperCase()}
								</Badge>
							)}
						</div>

						{book.year && (
							<span className="text-xs font-medium text-muted-foreground/60 tabular-nums">
								{book.year}
							</span>
						)}
					</div>
				</div>
			</div>
		</motion.div>
	);
}
