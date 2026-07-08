"use client";

import type { User } from "@supabase/supabase-js";
import {
	AlertCircle,
	CheckCircle2,
	Copy,
	DatabaseZap,
	Key,
	Library,
	Loader2,
	Menu,
	ShieldCheck,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FileLinkingView } from "@/components/admin/file-linking-view";
import { SyncResultsPanel } from "@/components/admin/sync-results-panel";
import {
	AdminToolCards,
	SyncSettingsShadix,
} from "@/components/admin/sync-settings-shadix";
import { TelegramFilesIndexer } from "@/components/admin/telegram-files-indexer";
import { TelegramStatsSection } from "@/components/admin/telegram-stats";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTransition } from "@/components/ui/page-transition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

	const [tgPhone, setTgPhone] = useState("");
	const [tgCode, setTgCode] = useState("");
	const [tgPassword, setTgPassword] = useState("");
	const [tgStep, setTgStep] = useState<"phone" | "code" | "password" | "done">(
		"phone",
	);
	const [tgLoading, setTgLoading] = useState(false);
	const [tgError, setTgError] = useState<string | null>(null);
	const [tgSession, setTgSession] = useState<string | null>(null);

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
			<div className="app-main-gradient flex min-h-screen items-center justify-center">
				<div className="space-y-4 text-center">
					<ShieldCheck className="mx-auto size-10 animate-pulse text-primary" />
					<p className="text-muted-foreground">Загрузка админ-панели...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="app-main-gradient flex min-h-screen items-center justify-center p-4">
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

	const handleTgRelogin = async () => {
		setTgError(null);
		setTgLoading(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const authHeaders = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.access_token}`,
			};

			if (tgStep === "phone") {
				const res = await fetch("/api/admin/telegram-relogin", {
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ action: "send_code", phone: tgPhone }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error);
				setTgStep("code");
				setTgLoading(false);
				return;
			}

			const body: any = {
				action: "sign_in",
				phone: tgPhone,
				code: tgCode,
			};
			if (tgStep === "password") {
				body.password = tgPassword;
			}

			const res = await fetch("/api/admin/telegram-relogin", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error);

			if (data.step === "password_needed") {
				setTgStep("password");
			} else if (data.session) {
				setTgSession(data.session);
				setTgStep("done");
			}
		} catch (err: any) {
			setTgError(err.message || "Ошибка авторизации");
		} finally {
			setTgLoading(false);
		}
	};

	const handleCopySession = () => {
		if (tgSession) {
			navigator.clipboard.writeText(tgSession);
		}
	};

	return (
		<PageTransition>
			<div className="app-main-gradient flex h-screen overflow-hidden">
				<div className="hidden lg:block">
					<AppSidebar
						user={user}
						userProfile={userProfile}
						onLogout={handleLogout}
					/>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					<header className="sticky top-0 z-30 border-b bg-background">
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
						<div className="fixed inset-0 z-50 bg-background/80 lg:hidden">
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
									collapsible={false}
								/>
							</div>
						</div>
					) : null}

					<main className="flex-1 overflow-y-auto">
						<Tabs defaultValue="dashboard" className="min-h-full">
							<div className="border-b bg-background">
								<div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
									<div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
										<div className="min-w-0 space-y-1">
											<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
												Администрирование
											</p>
											<h2 className="font-semibold text-2xl tracking-tight">
												Операционный центр библиотеки
											</h2>
										</div>

										<div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
											<div className="rounded-md border bg-card px-3 py-2">
												<p className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
													BookWorm
												</p>
												<p className="mt-1 truncate font-semibold text-sm">
													{bookWormRunning ? "В работе" : "Готов"}
												</p>
											</div>
											<div className="rounded-md border bg-card px-3 py-2">
												<p className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
													Автообновление
												</p>
												<p className="mt-1 truncate font-semibold text-sm">
													{bookWormAutoUpdate ? "Включено" : "Выключено"}
												</p>
											</div>
											<div className="rounded-md border bg-card px-3 py-2">
												<p className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
													Обновления
												</p>
												<p className="mt-1 font-semibold text-sm">
													{syncRefreshTrigger || 0}
												</p>
											</div>
										</div>
									</div>

									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="dashboard">Дашборд</TabsTrigger>
										<TabsTrigger value="file-linking">
											Привязка файлов
										</TabsTrigger>
									</TabsList>
								</div>
							</div>

							<TabsContent value="dashboard" className="mt-0">
								<div className="mx-auto grid w-full max-w-[1320px] items-start gap-6 px-4 py-7 sm:px-6 lg:px-8 xl:grid-cols-[1fr_1fr_420px]">
									<div className="contents">
										<div className="grid gap-6 xl:contents">
											<div className="xl:col-span-2">
												<TelegramStatsSection />
											</div>
											<div className="grid gap-6 xl:contents">
												<div className="xl:col-start-1 xl:row-start-2">
													<SyncSettingsShadix
														bookWormRunning={bookWormRunning}
														bookWormMode={bookWormMode}
														bookWormInterval={bookWormInterval}
														bookWormAutoUpdate={bookWormAutoUpdate}
														handleRunBookWorm={handleRunBookWorm}
														handleToggleAutoUpdate={setBookWormAutoUpdate}
														setBookWormInterval={setBookWormInterval}
													/>
												</div>
												<div className="xl:col-start-2 xl:row-start-2">
													<TelegramFilesIndexer />
												</div>
											</div>
										</div>

										<aside className="space-y-6 xl:col-start-3 xl:row-span-2 xl:row-start-1">
											<Card className="min-h-[176px] rounded-lg">
												<CardHeader className="pb-2">
													<CardTitle className="flex items-center gap-2">
														<Key className="h-4 w-4 text-muted-foreground" />
														Переподключение Telegram
													</CardTitle>
												</CardHeader>
												<CardContent className="pt-0">
													{tgStep === "done" && tgSession ? (
														<div className="space-y-3">
															<div className="flex items-center gap-2 text-emerald-600 text-sm">
																<CheckCircle2 className="size-4" />
																Сессия получена
															</div>
															<div className="relative">
																<pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-muted-foreground text-xs break-all">
																	{tgSession}
																</pre>
																<Button
																	size="icon"
																	variant="ghost"
																	className="absolute top-1 right-1 h-7 w-7"
																	onClick={handleCopySession}
																>
																	<Copy className="size-3" />
																</Button>
															</div>
															<p className="text-muted-foreground text-xs">
																Скопируйте и вставьте в{" "}
																<code>TELEGRAM_SESSION</code> в{" "}
																<code>.env</code>, затем перезапустите сервер.
															</p>
															<Button
																variant="outline"
																size="sm"
																className="w-full"
																onClick={() => {
																	setTgStep("phone");
																	setTgPhone("");
																	setTgCode("");
																	setTgPassword("");
																	setTgSession(null);
																	setTgError(null);
																}}
															>
																Ещё раз
															</Button>
														</div>
													) : (
														<div className="space-y-3">
															{tgError && (
																<div className="text-destructive text-xs p-2 bg-destructive/10 rounded-md">
																	{tgError}
																</div>
															)}

															{tgStep === "phone" && (
																<div className="space-y-2">
																	<Label className="text-xs">Телефон</Label>
																	<div className="flex gap-2">
																		<Input
																			placeholder="+79001234567"
																			value={tgPhone}
																			onChange={(e) =>
																				setTgPhone(e.target.value)
																			}
																			className="h-8 text-sm"
																			onKeyDown={(e) =>
																				e.key === "Enter" && handleTgRelogin()
																			}
																		/>
																		<Button
																			size="sm"
																			onClick={handleTgRelogin}
																			disabled={tgLoading || !tgPhone}
																		>
																			Далее
																		</Button>
																	</div>
																</div>
															)}

															{tgStep === "code" && (
																<>
																	<p className="text-muted-foreground text-xs">
																		Введите код, полученный в Telegram на{" "}
																		{tgPhone}
																	</p>
																	<div className="space-y-1">
																		<Label className="text-xs">
																			Код из Telegram
																		</Label>
																		<div className="flex gap-2">
																			<Input
																				placeholder="12345"
																				value={tgCode}
																				onChange={(e) =>
																					setTgCode(e.target.value)
																				}
																				className="h-8 text-sm font-mono"
																				onKeyDown={(e) =>
																					e.key === "Enter" && handleTgRelogin()
																				}
																			/>
																			<Button
																				size="sm"
																				onClick={handleTgRelogin}
																				disabled={tgLoading || !tgCode}
																			>
																				{tgLoading ? (
																					<Loader2 className="size-3 animate-spin" />
																				) : (
																					"OK"
																				)}
																			</Button>
																		</div>
																	</div>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 text-xs"
																		onClick={() => {
																			setTgStep("phone");
																			setTgCode("");
																		}}
																	>
																		Назад
																	</Button>
																</>
															)}

															{tgStep === "password" && (
																<>
																	<p className="text-muted-foreground text-xs">
																		Введите пароль двухфакторной аутентификации
																	</p>
																	<div className="space-y-1">
																		<Label className="text-xs">
																			Пароль 2FA
																		</Label>
																		<div className="flex gap-2">
																			<Input
																				type="password"
																				placeholder="Пароль"
																				value={tgPassword}
																				onChange={(e) =>
																					setTgPassword(e.target.value)
																				}
																				className="h-8 text-sm"
																				onKeyDown={(e) =>
																					e.key === "Enter" && handleTgRelogin()
																				}
																			/>
																			<Button
																				size="sm"
																				onClick={handleTgRelogin}
																				disabled={tgLoading || !tgPassword}
																			>
																				{tgLoading ? (
																					<Loader2 className="size-3 animate-spin" />
																				) : (
																					"OK"
																				)}
																			</Button>
																		</div>
																	</div>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 text-xs"
																		onClick={() => setTgStep("code")}
																	>
																		Назад
																	</Button>
																</>
															)}
														</div>
													)}
												</CardContent>
											</Card>
											<AdminToolCards />
										</aside>
									</div>
									<Card className="min-h-[156px] rounded-lg xl:col-span-3">
										<CardHeader className="pb-2">
											<CardTitle className="flex items-center gap-2">
												<DatabaseZap className="h-4 w-4 text-muted-foreground" />
												Операционный журнал
											</CardTitle>
										</CardHeader>
										<CardContent className="pt-0">
											<pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-muted-foreground text-xs">
												{lastBookWormReport ||
													"Событий в текущей сессии пока нет."}
											</pre>
										</CardContent>
									</Card>
									<div className="xl:col-span-3">
										<SyncResultsPanel refreshTrigger={syncRefreshTrigger} />
									</div>
								</div>
							</TabsContent>
							<TabsContent value="file-linking" className="mt-0">
								<FileLinkingView />
							</TabsContent>
						</Tabs>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}
