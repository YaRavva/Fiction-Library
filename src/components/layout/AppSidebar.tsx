"use client";

import type { Session } from "@supabase/supabase-js";
import {
	BookOpen,
	Library,
	LogOut,
	PanelLeftClose,
	PanelLeftOpen,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
	collapsible?: boolean;
}

const mainItems = [
	{ icon: Library, label: "Каталог", href: "/library" },
	{ icon: BookOpen, label: "Мои книги", href: "/my-books" },
];

export function AppSidebar({
	user,
	userProfile,
	onLogout,
	collapsible = true,
}: AppSidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [collapsed, setCollapsed] = useState(false);
	const canOpenAdmin =
		userProfile?.role === "admin" || user?.email === "ravva@bk.ru";
	const isCollapsed = collapsible && collapsed;

	const navigate = (href: string) => {
		router.push(href);
	};

	return (
		<aside
			className={cn(
				"relative z-10 flex h-full w-full flex-col border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:h-screen lg:border-r",
				isCollapsed ? "lg:w-20" : "lg:w-72",
			)}
		>
			<div className="border-sidebar-border border-b px-4 py-4">
				<button
					type="button"
					className={cn(
						"flex w-full items-center gap-3 text-left",
						isCollapsed && "lg:justify-center",
					)}
					onClick={() => navigate("/library")}
				>
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
						<Library className="size-5" />
					</div>
					<div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
						<div className="truncate font-semibold text-[15px] tracking-tight">
							Fiction Library
						</div>
						<div className="truncate text-muted-foreground text-xs">
							Электронная библиотека
						</div>
					</div>
				</button>
			</div>

			<nav className="space-y-1 px-3 py-4">
				<p
					className={cn(
						"px-3 pb-2 font-medium text-[11px] text-muted-foreground uppercase",
						isCollapsed && "lg:sr-only",
					)}
				>
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
								isCollapsed && "lg:justify-center lg:px-0",
								active &&
									"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
							)}
							onClick={() => navigate(item.href)}
							title={isCollapsed ? item.label : undefined}
						>
							<item.icon className="size-4 shrink-0" />
							<span className={cn(isCollapsed && "lg:sr-only")}>
								{item.label}
							</span>
						</Button>
					);
				})}

				{canOpenAdmin && (
					<>
						<p
							className={cn(
								"px-3 pb-2 pt-5 font-medium text-[11px] text-muted-foreground uppercase",
								isCollapsed && "lg:sr-only",
							)}
						>
							Операции
						</p>
						<Button
							variant="ghost"
							className={cn(
								"h-10 w-full justify-start rounded-md px-3 font-medium text-sm",
								isCollapsed && "lg:justify-center lg:px-0",
								pathname?.startsWith("/admin") &&
									"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
							)}
							onClick={() => navigate("/admin")}
							title={isCollapsed ? "Админ-панель" : undefined}
						>
							<ShieldCheck className="size-4 shrink-0" />
							<span className={cn(isCollapsed && "lg:sr-only")}>
								Админ-панель
							</span>
						</Button>
					</>
				)}
			</nav>

			<div className="mt-auto border-sidebar-border border-t p-3">
				{collapsible ? (
					<Button
						variant="ghost"
						size="icon"
						className="mb-2 hidden size-10 w-full rounded-md lg:flex"
						onClick={() => setCollapsed((value) => !value)}
						title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
					>
						{isCollapsed ? (
							<PanelLeftOpen className="size-4" />
						) : (
							<PanelLeftClose className="size-4" />
						)}
					</Button>
				) : null}

				{user ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className={cn(
									"h-auto w-full justify-start gap-3 rounded-md px-2 py-2",
									isCollapsed && "lg:justify-center lg:px-0",
								)}
								title={
									isCollapsed
										? userProfile?.display_name || user.email || undefined
										: undefined
								}
							>
								<Avatar className="size-9 border">
									<AvatarFallback>
										{userProfile?.display_name?.[0] || user.email?.[0] || "U"}
									</AvatarFallback>
								</Avatar>
								<div
									className={cn(
										"min-w-0 text-left",
										isCollapsed && "lg:hidden",
									)}
								>
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
					<Button
						className={cn("w-full", isCollapsed && "lg:px-0")}
						onClick={() => navigate("/auth/login")}
						title={isCollapsed ? "Войти" : undefined}
					>
						<span className={cn(isCollapsed && "lg:sr-only")}>Войти</span>
						{isCollapsed ? (
							<UserRound className="hidden size-4 lg:block" />
						) : null}
					</Button>
				)}
			</div>
		</aside>
	);
}
