"use client";

import type { Session } from "@supabase/supabase-js";
import { Book, LogOut, Settings, Shield, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface UserProfile {
	id: string;
	username?: string;
	display_name?: string;
	role: string;
}

interface AppSidebarProps {
	user: Session["user"] | null;
	userProfile: UserProfile | null;
	onLogout: () => void;
}

const menuItems = [
	{ icon: Book, label: "Библиотека", href: "/library" },
	{ icon: Book, label: "Мои книги", href: "/my-books" },
];

export function AppSidebar({ user, userProfile, onLogout }: AppSidebarProps) {
	const pathname = usePathname();
	const router = useRouter();

	const handleNavigation = (href: string) => {
		router.push(href);
	};

	return (
		<aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r bg-card/30 backdrop-blur-xl p-6 z-40">
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
					// Более точная логика активности
					const isActive =
						item.href === "/"
							? pathname === "/"
							: pathname === item.href || pathname?.startsWith(`${item.href}/`);

					// Если мы на админке, ни один из основных пунктов (кроме, возможно, корневого если нужно) не должен быть активен
					const isActualActive = isActive && !pathname?.startsWith("/admin");

					return (
						<Button
							key={item.label}
							variant={isActualActive ? "secondary" : "ghost"}
							className={cn(
								"w-full justify-start gap-3 h-11 rounded-xl font-medium",
								isActualActive &&
									"bg-primary/10 text-primary hover:bg-primary/15",
							)}
							onClick={() => handleNavigation(item.href)}
						>
							<item.icon className="w-5 h-5" />
							{item.label}
						</Button>
					);
				})}

				{(userProfile?.role === "admin" || user?.email === "ravva@bk.ru") && (
					<Button
						variant={pathname?.startsWith("/admin") ? "secondary" : "ghost"}
						className={cn(
							"w-full justify-start gap-3 h-11 rounded-xl font-medium",
							pathname?.startsWith("/admin") &&
								"bg-primary/10 text-primary hover:bg-primary/15",
						)}
						onClick={() => handleNavigation("/admin")}
					>
						<Shield className="w-5 h-5" />
						Админ-панель
					</Button>
				)}
			</nav>

			<div className="mt-auto pt-6 border-t space-y-4">
				<div className="flex items-center justify-between">
					<ThemeToggle />
					<span className="text-xs text-muted-foreground">Тема</span>
				</div>

				{user ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="w-full justify-start gap-3 h-14 rounded-xl px-2 hover:bg-muted/50"
							>
								<Avatar className="h-9 w-9 border">
									<AvatarFallback>
										{userProfile?.display_name?.[0] || user.email?.[0] || "U"}
									</AvatarFallback>
								</Avatar>
								<div className="flex flex-col items-start text-sm">
									<span className="font-medium truncate w-32 text-left">
										{userProfile?.display_name || "Пользователь"}
									</span>
									<span className="text-xs text-muted-foreground truncate w-32 text-left">
										{user.email}
									</span>
								</div>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onLogout}
								className="text-destructive focus:text-destructive"
							>
								<LogOut className="mr-2 h-4 w-4" />
								<span>Выйти</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Button onClick={() => router.push("/auth/login")} className="w-full">
						Войти
					</Button>
				)}
			</div>
		</aside>
	);
}
