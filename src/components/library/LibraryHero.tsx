"use client";

import { motion } from "framer-motion";

export function LibraryHero() {
	return (
		<div className="relative w-full py-12 md:py-20 overflow-hidden mb-8">
			{/* Abstract Background Elements */}


			<div className="container mx-auto px-4 relative z-10">
				<div className="max-w-3xl mx-auto text-center space-y-6">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
					>
						<h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
							Ваша личная вселенная
							<br />
							<span className="text-primary">книг и историй</span>
						</h1>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
