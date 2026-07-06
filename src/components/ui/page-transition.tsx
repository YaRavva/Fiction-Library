"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface PageTransitionProps {
	children: ReactNode;
	className?: string;
}

const pageVariants = {
	initial: {
		opacity: 0,
		y: 12,
	},
	in: {
		opacity: 1,
		y: 0,
	},
	out: {
		opacity: 0,
		y: -12,
	},
};

const pageTransition = {
	type: "tween" as const,
	ease: "easeOut" as const,
	duration: 0.25,
};

export function PageTransition({
	children,
	className = "",
}: PageTransitionProps) {
	const pathname = usePathname();

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={pathname}
				initial="initial"
				animate="in"
				exit="out"
				variants={pageVariants}
				transition={pageTransition}
				className={className}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
}

// Компонент для анимации загрузки контента
export function ContentTransition({
	children,
	loading = false,
	className = "",
}: {
	children: ReactNode;
	loading?: boolean;
	className?: string;
}) {
	return (
		<AnimatePresence mode="wait">
			{loading ? (
				<motion.div
					key="loading"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					className={`flex items-center justify-center p-8 ${className}`}
				>
					<div className="flex items-center space-x-2">
						<div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
						<div className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:0.2s]" />
						<div className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:0.4s]" />
					</div>
				</motion.div>
			) : (
				<motion.div
					key="content"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					className={className}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// Компонент для анимации списков
export function ListTransition({
	children,
	className = "",
	staggerDelay = 0.1,
}: {
	children: ReactNode[];
	className?: string;
	staggerDelay?: number;
}) {
	return (
		<motion.div
			initial="hidden"
			animate="visible"
			variants={{
				hidden: { opacity: 0 },
				visible: {
					opacity: 1,
					transition: {
						staggerChildren: staggerDelay,
					},
				},
			}}
			className={className}
		>
			{children.map((child, index) => (
				<motion.div
					key={index}
					variants={{
						hidden: { opacity: 0, y: 10 },
						visible: { opacity: 1, y: 0 },
					}}
					transition={{ duration: 0.2 }}
				>
					{child}
				</motion.div>
			))}
		</motion.div>
	);
}
