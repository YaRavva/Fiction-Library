"use client";

import type { Session } from "@supabase/supabase-js";
import {
	BookOpen,
	Library,
	LogOut,
	ShieldCheck,
	UserRound,
} from "lucide-react";
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

const mainItems = [
	{ icon: Library, label: "Каталог", href: "/library" },
	{ icon: BookOpen, label: "Мои книги", href: "/my-books" },
];

export function AppSidebar({ user, userProfile, onLogout }: AppSidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const canOpenAdmin =
		userProfile?.role === "admin" || user?.email === "ravva@bk.ru";

	const navigate = (href: string) => {
		router.push(href);
	};

	return (
		<aside className="relative z-10 flex h-full w-full flex-col border-sidebar-border bg-sidebar text-sidebar-foreground lg:h-screen lg:w-72 lg:border-r">
			<div className="border-sidebar-border border-b px-5 py-5">
				<button
					type="button"
					className="flex w-full items-center gap-3 text-left"
					onClick={() => navigate("/library")}
				>
					<div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
						<Library className="size-5" />
					</div>
					<div className="min-w-0">
						<div className="truncate font-semibold text-[15px] tracking-tight">
							Fiction Library
						</div>
						<div className="truncate text-muted-foreground text-xs">
							Частная электронная библиотека
						</div>
					</div>
				</button>
			</div>

			<nav className="flex-1 space-y-1 px-3 py-4">
				<p className="px-3 pb-2 font-medium text-[11px] text-muted-foreground uppercase">
					Работа
				</p>
				{mainItems.map((item) => {
					const active =
						pathname === item.href || pathname?.startsWith(`${item.href}/`);

					return (
						<Button
							key={item.href}
							variant="ghost"
							className={cn(
								"h-10 w-full justify-start rounded-md px-3 font-medium text-sm",
								active &&
									"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
							)}
							onClick={() => navigate(item.href)}
						>
							<item.icon className="size-4" />
							{item.label}
						</Button>
					);
				})}

				{canOpenAdmin && (
					<>
						<p className="px-3 pb-2 pt-5 font-medium text-[11px] text-muted-foreground uppercase">
							Операции
						</p>
						<Button
							variant="ghost"
							className={cn(
								"h-10 w-full justify-start rounded-md px-3 font-medium text-sm",
								pathname?.startsWith("/admin") &&
									"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
							)}
							onClick={() => navigate("/admin")}
						>
							<ShieldCheck className="size-4" />
							Админ-панель
						</Button>
					</>
				)}
			</nav>

			<div className="border-sidebar-border border-t p-3">
				<div className="mb-3 flex items-center justify-between rounded-md border border-sidebar-border bg-background/45 px-3 py-2">
					<span className="font-medium text-muted-foreground text-xs">
						Тема
					</span>
					<ThemeToggle />
				</div>

				{user ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="h-auto w-full justify-start gap-3 rounded-md px-2 py-2"
							>
								<Avatar className="size-9 border">
									<AvatarFallback>
										{userProfile?.display_name?.[0] || user.email?.[0] || "U"}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 text-left">
									<div className="truncate font-medium text-sm">
										{userProfile?.display_name || "Пользователь"}
									</div>
									<div className="truncate text-muted-foreground text-xs">
										{user.email}
									</div>
								</div>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-60">
							<DropdownMenuLabel>Аккаунт</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem disabled>
								<UserRound className="mr-2 size-4" />
								{userProfile?.role || "reader"}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={onLogout}
								className="text-destructive focus:text-destructive"
							>
								<LogOut className="mr-2 size-4" />
								Выйти
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Button className="w-full" onClick={() => navigate("/auth/login")}>
						Войти
					</Button>
				)}
			</div>
		</aside>
	);
}
