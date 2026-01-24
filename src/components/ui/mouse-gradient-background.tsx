"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function MouseGradientBackground() {
	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);

	const [mounted, setMounted] = useState(false);

	// Smooth spring animation for the main follower
	const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
	const x = useSpring(mouseX, springConfig);
	const y = useSpring(mouseY, springConfig);

	// Slower follower for depth
	const springConfigSlow = { damping: 40, stiffness: 80, mass: 1 };
	const x2 = useSpring(mouseX, springConfigSlow);
	const y2 = useSpring(mouseY, springConfigSlow);

	useEffect(() => {
		setMounted(true);

		// Initialize to center
		if (typeof window !== "undefined") {
			mouseX.set(window.innerWidth / 2);
			mouseY.set(window.innerHeight / 2);
		}

		const handleMouseMove = (e: MouseEvent) => {
			mouseX.set(e.clientX);
			mouseY.set(e.clientY);
		};

		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, [mouseX, mouseY]);

	if (!mounted) return null;

	return (
		<div className="fixed inset-0 overflow-hidden pointer-events-none z-0 user-select-none bg-[#FAFAFA] dark:bg-background transition-colors duration-700">
			{/* Static Mesh Gradient Base */}
			<div className="absolute inset-0 opacity-60 dark:opacity-20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-100/50 via-transparent to-transparent" />
			<div className="absolute inset-0 opacity-40 dark:opacity-20 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-amber-100/40 via-transparent to-transparent" />

			{/* Main vibrant gradient follower */}
			<motion.div
				style={{ x, y }}
				className="absolute -inset-20 opacity-30 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen will-change-transform"
			>
				<div className="w-[800px] h-[800px] rounded-full blur-[120px] bg-gradient-to-r from-amber-200/40 to-purple-200/40 dark:from-amber-500/20 dark:to-purple-500/20 -translate-x-1/2 -translate-y-1/2" />
			</motion.div>

			{/* Secondary contrasting foil - lagging slightly */}
			<motion.div
				style={{ x: x2, y: y2 }}
				className="absolute -inset-20 opacity-20 dark:opacity-15 mix-blend-multiply dark:mix-blend-screen will-change-transform"
			>
				<div className="w-[600px] h-[600px] rounded-full blur-[100px] bg-gradient-to-tr from-purple-300/30 to-blue-200/30 dark:from-purple-500/20 dark:to-blue-500/20 -translate-x-1/2 -translate-y-1/2" />
			</motion.div>

			{/* Floating Ambient Blobs - Top Right */}
			<motion.div
				animate={{
					scale: [1, 1.1, 1],
					x: [0, 20, 0],
					y: [0, -20, 0],
				}}
				transition={{
					duration: 10,
					repeat: Infinity,
					ease: "easeInOut",
				}}
				className="absolute top-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-amber-200/30 dark:bg-amber-900/20 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-30"
			/>

			{/* Floating Ambient Blobs - Bottom Left */}
			<motion.div
				animate={{
					scale: [1, 1.2, 1],
					x: [0, -30, 0],
					y: [0, 30, 0],
				}}
				transition={{
					duration: 15,
					repeat: Infinity,
					ease: "easeInOut",
				}}
				className="absolute bottom-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-purple-200/30 dark:bg-purple-900/20 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-30"
			/>

			{/* Additional Center Accent */}
			<motion.div
				animate={{
					scale: [1, 1.15, 1],
					opacity: [0.3, 0.5, 0.3],
				}}
				transition={{
					duration: 20,
					repeat: Infinity,
					ease: "easeInOut",
				}}
				className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[60vw] h-[60vw] bg-pink-100/20 dark:bg-pink-900/10 blur-[180px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-40 dark:opacity-20"
			/>
		</div>
	);
}
