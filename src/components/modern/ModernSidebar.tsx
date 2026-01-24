"use client";

import { Book, LogOut, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const menuItems = [
	{ icon: Book, label: "Библиотека", href: "/library" },
	{ icon: Book, label: "Мои книги", href: "/my-books" },
];

export function ModernSidebar() {
	const pathname = usePathname();
	const router = useRouter();

	return (
		<aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r bg-card/30 backdrop-blur-xl p-6">
			<div
				className="flex items-center gap-2 mb-10 cursor-pointer"
				onClick={() => router.push("/library")}
			>
				<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
					<Book className="w-5 h-5 text-primary-foreground" />
				</div>
				<span className="font-bold text-xl tracking-tight">FictionLib</span>
			</div>

			<nav className="flex-1 space-y-2">
				{menuItems.map((item) => {
					const isActive =
						item.href === "/"
							? pathname === "/"
							: pathname === item.href || pathname?.startsWith(`${item.href}/`);

					return (
						<Button
							key={item.label}
							variant={isActive ? "secondary" : "ghost"}
							className={cn(
								"w-full justify-start gap-3 h-11 rounded-xl font-medium",
								isActive && "bg-primary/10 text-primary hover:bg-primary/15",
							)}
							onClick={() => router.push(item.href)}
						>
							<item.icon className="w-5 h-5" />
							{item.label}
						</Button>
					);
				})}
			</nav>

			<div className="mt-auto pt-6 border-t space-y-2">
				<Button
					variant="ghost"
					className="w-full justify-start gap-3 h-11 rounded-xl text-muted-foreground"
				>
					<Settings className="w-5 h-5" />
					Настройки
				</Button>
				<Button
					variant="ghost"
					className="w-full justify-start gap-3 h-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
				>
					<LogOut className="w-5 h-5" />
					Выйти
				</Button>
			</div>
		</aside>
	);
}
