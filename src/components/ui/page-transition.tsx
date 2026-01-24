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
		y: 20,
		scale: 0.98,
	},
	in: {
		opacity: 1,
		y: 0,
		scale: 1,
	},
	out: {
		opacity: 0,
		y: -20,
		scale: 1.02,
	},
};

const pageTransition = {
	type: "tween" as const,
	ease: "anticipate" as const,
	duration: 0.4,
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
					transition={{ duration: 0.2 }}
					className={`flex items-center justify-center p-8 ${className}`}
				>
					<div className="flex items-center space-x-2">
						<motion.div
							className="w-2 h-2 bg-primary rounded-full"
							animate={{
								scale: [1, 1.2, 1],
								opacity: [1, 0.5, 1],
							}}
							transition={{
								duration: 1,
								repeat: Infinity,
								delay: 0,
							}}
						/>
						<motion.div
							className="w-2 h-2 bg-primary rounded-full"
							animate={{
								scale: [1, 1.2, 1],
								opacity: [1, 0.5, 1],
							}}
							transition={{
								duration: 1,
								repeat: Infinity,
								delay: 0.2,
							}}
						/>
						<motion.div
							className="w-2 h-2 bg-primary rounded-full"
							animate={{
								scale: [1, 1.2, 1],
								opacity: [1, 0.5, 1],
							}}
							transition={{
								duration: 1,
								repeat: Infinity,
								delay: 0.4,
							}}
						/>
					</div>
				</motion.div>
			) : (
				<motion.div
					key="content"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.3 }}
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
						hidden: { opacity: 0, y: 20 },
						visible: { opacity: 1, y: 0 },
					}}
					transition={{ duration: 0.3 }}
				>
					{child}
				</motion.div>
			))}
		</motion.div>
	);
}
