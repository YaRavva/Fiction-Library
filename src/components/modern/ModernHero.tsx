"use client";

import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ModernHero() {
	return (
		<div className="relative w-full py-8 sm:py-12 md:py-16 lg:py-24 overflow-hidden">
			{/* Abstract Background Elements */}
			<div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
				<motion.div
					animate={{
						scale: [1, 1.1, 1],
						rotate: [0, 5, 0],
						opacity: [0.3, 0.5, 0.3],
					}}
					transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
					className="absolute -top-20 -left-20 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-primary/20 rounded-full blur-3xl"
				/>
				<motion.div
					animate={{
						scale: [1, 1.2, 1],
						x: [0, 50, 0],
						opacity: [0.2, 0.4, 0.2],
					}}
					transition={{
						duration: 15,
						repeat: Infinity,
						ease: "easeInOut",
						delay: 2,
					}}
					className="absolute top-40 right-0 w-64 h-64 sm:w-80 sm:h-80 md:w-[30rem] md:h-[30rem] bg-indigo-500/20 rounded-full blur-3xl"
				/>
			</div>

			<div className="container mx-auto px-4 relative z-10">
				<div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
					>
						<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
							Ваша личная вселенная
							<br />
							<span className="text-primary">книг и историй</span>
						</h1>
					</motion.div>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto px-4 sm:px-0"
					>
						Погрузитесь в мир литературы с нашим современным ридером. Тысячи
						книг, удобный поиск и синхронизация прогресса.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.4 }}
						className="flex flex-col sm:flex-row items-center gap-2 max-w-lg mx-auto bg-card/80 backdrop-blur-xl p-2 rounded-2xl border shadow-lg"
					>
						<div className="flex-1 w-full relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								placeholder="Найти книгу, автора или жанр..."
								className="pl-9 border-0 bg-transparent focus-visible:ring-0 h-11"
							/>
						</div>
						<div className="flex gap-2 w-full sm:w-auto">
							<Button size="icon" variant="ghost" className="h-10 w-10 shrink-0">
								<SlidersHorizontal className="w-4 h-4" />
							</Button>
							<Button className="h-10 rounded-xl px-6 flex-1 sm:flex-none">Найти</Button>
						</div>
					</motion.div>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.6, delay: 0.6 }}
						className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground pt-2 sm:pt-4"
					>
						<span className="font-medium">Популярное:</span>
						<div className="flex flex-wrap gap-2 justify-center">
							{["Фантастика", "Психология", "Бизнес", "Романы"].map((tag) => (
								<span
									key={tag}
									className="px-2 py-1 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors text-xs sm:text-sm"
								>
									{tag}
								</span>
							))}
						</div>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
