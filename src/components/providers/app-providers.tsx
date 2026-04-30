"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { MouseGradientBackground } from "@/components/ui/mouse-gradient-background";
import { ToasterProvider } from "@/components/providers/toaster-provider";

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			<MouseGradientBackground />
			<div className="relative z-10 flex min-h-screen flex-col">{children}</div>
			<ToasterProvider />
		</ThemeProvider>
	);
}
