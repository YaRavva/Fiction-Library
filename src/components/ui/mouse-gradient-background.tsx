"use client";

import { useEffect, useState } from "react";

export function MouseGradientBackground() {
	const [mounted, setMounted] = useState(false);
	const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

	useEffect(() => {
		setMounted(true);

		const handleMouseMove = (e: MouseEvent) => {
			setPos({
				x: e.clientX / window.innerWidth,
				y: e.clientY / window.innerHeight,
			});
		};

		window.addEventListener("mousemove", handleMouseMove, { passive: true });
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

	if (!mounted) return null;

	return (
		<div
			className="fixed inset-0 pointer-events-none z-0 bg-[#FAFAFA] dark:bg-background transition-colors duration-700"
			style={{
				backgroundImage: `
					radial-gradient(ellipse at ${pos.x * 100}% ${pos.y * 100}%, rgba(251, 191, 36, 0.08) 0%, transparent 60%),
					radial-gradient(ellipse at ${(1 - pos.x) * 100}% ${(1 - pos.y) * 100}%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
					radial-gradient(ellipse at top left, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
					radial-gradient(ellipse at bottom right, rgba(245, 158, 11, 0.06) 0%, transparent 50%)
				`,
			}}
		/>
	);
}
