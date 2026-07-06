"use client";

import type { User } from "@supabase/supabase-js";
import {
	Activity,
	AlertCircle,
	Bot,
	Clock3,
	DatabaseZap,
	Library,
	Menu,
	ShieldCheck,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SyncResultsPanel } from "@/components/admin/sync-results-panel";
import { SyncSettingsShadix } from "@/components/admin/sync-settings-shadix";
import { TelegramFilesIndexer } from "@/components/admin/telegram-files-indexer";
import { TelegramStatsSection } from "@/components/admin/telegram-stats";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";

interface UserProfile {
	id: string;
	username?: string;
	display_name?: string;
	role: string;
}

export default function AdminPage() {
	const [supabase] = useState(() => getBrowserSupabase());
	const router = useRouter();

	const [loading, setLoading] = useState(true);
	const [bookWormRunning, setBookWormRunning] = useState(false);
	const [bookWormMode, setBookWormMode] = useState<"full" | "update" | null>(
		null,
	);
	const [bookWormInterval, setBookWormInterval] = useState(30);
	const [bookWormAutoUpdate, setBookWormAutoUpdate] = useState(false);
	const [lastBookWormReport, setLastBookWormReport] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [syncRefreshTrigger, setSyncRefreshTrigger] = useState(0);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const session = await getValidSession(supabase);
				if (!session) {
					router.push("/auth/login");
					return;
				}

				setUser(session.user);

				const { data: profile, error: profileError } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", session.user.id)
					.single();

				if (profileError || profile?.role !== "admin") {
					router.push("/library");
					return;
				}

				setUserProfile(profile as UserProfile);
			} catch (error) {
				console.error("Error checking admin access:", error);
				setError("Не удалось проверить доступ к админ-панели.");
			} finally {
				setLoading(false);
			}
		};

		checkAuth();
	}, [supabase, router]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const win = window as unknown as {
			setStatsUpdateReport?: (report: string) => void;
			updateFileSearchResults?: (report: string) => void;
		};

		win.setStatsUpdateReport = (report: string) => {
			setLastBookWormReport((prev) => prev + report);
		};

		win.updateFileSearchResults = (report: string) => {
			setLastBookWormReport((prev) => prev + report);
		};

		return () => {
			delete win.setStatsUpdateReport;
			delete win.updateFileSearchResults;
		};
	}, []);

	const checkAutoUpdate = useCallback(async () => {
		if (!bookWormAutoUpdate) return;

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/book-worm/auto-update", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			const timestamp = new Date().toLocaleTimeString("ru-RU");
			if (response.ok) {
				const data = await response.json();
				setLastBookWormReport(
					(prev) =>
						`${prev}[${timestamp}] ${data.message || "Проверка выполнена"}\n`,
				);
			} else {
				setLastBookWormReport(
					(prev) =>
						`${prev}[${timestamp}] Ошибка авто-проверки: ${response.statusText}\n`,
				);
			}
		} catch (error) {
			console.error("Error checking auto update:", error);
		}
	}, [bookWormAutoUpdate, supabase.auth]);

	useEffect(() => {
		if (!bookWormAutoUpdate) return;

		const interval = setInterval(
			checkAutoUpdate,
			Math.max(30, bookWormInterval) * 60 * 1000,
		);

		return () => clearInterval(interval);
	}, [bookWormAutoUpdate, bookWormInterval, checkAutoUpdate]);

	const handleRunBookWorm = async (mode: "full" | "update") => {
		setBookWormRunning(true);
		setBookWormMode(mode);
		setError(null);
		setLastBookWormReport(
			`Запуск синхронизации: ${mode === "full" ? "полная" : "обновление"}...\n`,
		);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				router.push("/auth/login");
				return;
			}

			const response = await fetch(
				mode === "full"
					? "/api/admin/book-worm/full-sync"
					: "/api/admin/book-worm",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${session.access_token}`,
					},
					body: JSON.stringify({ mode }),
				},
			);

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || "Ошибка запуска синхронизации");
			}

			setLastBookWormReport(
				data.formattedMessage ||
					data.report ||
					`Синхронизация запущена. Статус: ${data.message || "ok"}\n`,
			);
		} catch (error) {
			console.error("Sync error:", error);
			const message =
				error instanceof Error ? error.message : "Неизвестная ошибка";
			setError(`Ошибка синхронизации: ${message}`);
			setLastBookWormReport((prev) => `${prev}Ошибка: ${message}\n`);
		} finally {
			setBookWormRunning(false);
			setBookWormMode(null);
			setSyncRefreshTrigger((prev) => prev + 1);
		}
	};

	const checkBookWormStatus = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/book-worm/status", {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			if (!response.ok) return;

			const data = await response.json();
			if (data.active) {
				setBookWormRunning(true);
			} else if (bookWormRunning) {
				setBookWormRunning(false);
				setSyncRefreshTrigger((prev) => prev + 1);
			}
		} catch (error) {
			console.error("Error checking sync status:", error);
		}
	}, [supabase.auth, bookWormRunning]);

	useEffect(() => {
		const interval = setInterval(checkBookWormStatus, 5000);
		return () => clearInterval(interval);
	}, [checkBookWormStatus]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="space-y-4 text-center">
					<ShieldCheck className="mx-auto size-10 animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка админ-панели...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="max-w-md">
					<CardContent className="space-y-4 p-6">
						<div className="flex items-center gap-2 font-semibold text-destructive">
							<AlertCircle className="size-5" />
							Ошибка
						</div>
						<p className="text-muted-foreground text-sm">{error}</p>
						<Button onClick={() => router.push("/library")}>
							Вернуться в библиотеку
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<PageTransition>
			<div className="flex h-screen overflow-hidden bg-background">
				<div className="hidden lg:block">
					<AppSidebar
						user={user}
						userProfile={userProfile}
						onLogout={handleLogout}
					/>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
						<div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
							<div className="min-w-0">
								<div className="flex items-center gap-2 lg:hidden">
									<Library className="size-5 text-primary" />
									<span className="font-semibold">Fiction Library</span>
								</div>
								<div className="hidden lg:block">
									<p className="text-muted-foreground text-xs">Операции</p>
									<h1 className="font-semibold text-lg tracking-tight">
										Админ-панель
									</h1>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<ThemeToggle />
								<Button
									variant="outline"
									size="icon"
									className="lg:hidden"
									onClick={() => setMobileMenuOpen(true)}
								>
									<Menu className="size-5" />
								</Button>
							</div>
						</div>
					</header>

					{mobileMenuOpen ? (
						<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
							<button
								type="button"
								className="absolute inset-0 h-full w-full"
								aria-label="Закрыть меню"
								onClick={() => setMobileMenuOpen(false)}
							/>
							<div className="fixed inset-y-0 left-0 z-10 flex w-72 flex-col bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
								<div className="flex items-center justify-between border-b p-4">
									<span className="font-semibold">Меню</span>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setMobileMenuOpen(false)}
									>
										<X className="size-5" />
									</Button>
								</div>
								<AppSidebar
									user={user}
									userProfile={userProfile}
									onLogout={handleLogout}
								/>
							</div>
						</div>
					) : null}

					<main className="flex-1 overflow-y-auto scrollbar-hide">
						<div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
							<section className="grid gap-3 md:grid-cols-3">
								<div className="rounded-lg border bg-card p-4 shadow-sm">
									<div className="mb-3 flex items-center justify-between">
										<p className="font-medium text-sm">BookWorm</p>
										<Bot className="size-4 text-muted-foreground" />
									</div>
									<p className="font-semibold text-2xl">
										{bookWormRunning ? "В работе" : "Готов"}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{bookWormMode
											? `Режим: ${bookWormMode}`
											: "Процесс синхронизации"}
									</p>
								</div>
								<div className="rounded-lg border bg-card p-4 shadow-sm">
									<div className="mb-3 flex items-center justify-between">
										<p className="font-medium text-sm">Автообновление</p>
										<Clock3 className="size-4 text-muted-foreground" />
									</div>
									<p className="font-semibold text-2xl">
										{bookWormAutoUpdate ? "Включено" : "Выключено"}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Интервал: {bookWormInterval} мин.
									</p>
								</div>
								<div className="rounded-lg border bg-card p-4 shadow-sm">
									<div className="mb-3 flex items-center justify-between">
										<p className="font-medium text-sm">История</p>
										<Activity className="size-4 text-muted-foreground" />
									</div>
									<p className="font-semibold text-2xl">
										{syncRefreshTrigger || 0}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										Обновлений панели за сессию
									</p>
								</div>
							</section>

							<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
								<div className="space-y-5">
									<TelegramStatsSection />
									<SyncSettingsShadix
										bookWormRunning={bookWormRunning}
										bookWormMode={bookWormMode}
										bookWormInterval={bookWormInterval}
										bookWormAutoUpdate={bookWormAutoUpdate}
										handleRunBookWorm={handleRunBookWorm}
										handleToggleAutoUpdate={setBookWormAutoUpdate}
										setBookWormInterval={setBookWormInterval}
									/>
									<TelegramFilesIndexer />
								</div>

								<aside className="space-y-5">
									<div className="rounded-lg border bg-card p-4 shadow-sm">
										<div className="mb-3 flex items-center gap-2">
											<DatabaseZap className="size-4 text-muted-foreground" />
											<h2 className="font-semibold text-sm">
												Операционный журнал
											</h2>
										</div>
										<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-muted-foreground text-xs">
											{lastBookWormReport ||
												"Событий в текущей сессии пока нет."}
										</pre>
									</div>
									<SyncResultsPanel refreshTrigger={syncRefreshTrigger} />
								</aside>
							</div>
						</div>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}
