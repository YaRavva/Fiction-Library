"use client";

import type { User } from "@supabase/supabase-js";
import { AlertCircle, Library, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SyncResultsPanel } from "@/components/admin/sync-results-panel";
import { SyncSettingsShadix } from "@/components/admin/sync-settings-shadix";
import { TelegramFilesIndexer } from "@/components/admin/telegram-files-indexer";
import { TelegramStatsSection } from "@/components/admin/telegram-stats";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	// Состояния только для Книжного червя
	const [bookWormRunning, setBookWormRunning] = useState(false);
	const [bookWormMode, setBookWormMode] = useState<"full" | "update" | null>(
		null,
	);
	const [bookWormInterval, setBookWormInterval] = useState(30);
	const [bookWormAutoUpdate, setBookWormAutoUpdate] = useState(false);
	const [lastBookWormReport, setLastBookWormReport] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [syncRefreshTrigger, setSyncRefreshTrigger] = useState(0);

	// Эффект для автоматической прокрутки текстового поля результатов
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
		}
	}, []);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/");
	};

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const session = await getValidSession(supabase);
				if (!session) {
					console.log("No valid session, redirecting to login...");
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
					console.warn("User not authorized as admin");
					router.push("/library");
					return;
				}
				setUserProfile(profile as UserProfile);
			} catch (error) {
				console.error("Error checking auth:", error);
				// router.push("/auth/login");
			} finally {
				setLoading(false);
			}
		};

		checkAuth();

		// Регистрируем глобальные функции для логирования в окно результатов
		if (typeof window !== "undefined") {
			// Функция для Книжного червя
			(
				window as unknown as { setStatsUpdateReport: (report: string) => void }
			).setStatsUpdateReport = (report: string) => {
				setLastBookWormReport((prev) => {
					const newReport = prev ? prev + report : report;
					return newReport;
				});
			};

			// Функция для поиска файлов
			(
				window as unknown as {
					updateFileSearchResults: (report: string) => void;
				}
			).updateFileSearchResults = (report: string) => {
				setLastBookWormReport((prev) => {
					const newReport = prev ? prev + report : report;
					return newReport;
				});
			};
		}

		// Инициализируем окно результатов пустым сообщением
		console.log("🔍 Initializing lastBookWormReport with empty string");
		setLastBookWormReport("");

		// Очищаем функции при размонтировании компонента
		return () => {
			if (typeof window !== "undefined") {
				const win = window as unknown as {
					setStatsUpdateReport?: unknown;
					updateFileSearchResults?: unknown;
				};
				if (win.setStatsUpdateReport) {
					delete win.setStatsUpdateReport;
				}
				if (win.updateFileSearchResults) {
					delete win.updateFileSearchResults;
				}
			}
		};
	}, [supabase, router]);

	// Функция для переключения автоматического обновления
	const handleToggleAutoUpdate = (checked: boolean) => {
		setBookWormAutoUpdate(checked);
	};

	// Функция для проверки необходимости автообновления (клиентская реализация как резервный вариант)
	const checkAutoUpdate = useCallback(async () => {
		if (!bookWormAutoUpdate) return; // Не проверяем, если автообновление отключено

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

			if (response.ok) {
				const data = await response.json();
				const timestamp = new Date().toLocaleTimeString("ru-RU");

				if (data.message === "Auto update started") {
					setLastBookWormReport(
						(prev) =>
							prev + `[${timestamp}] 🚀 Автоматическое обновление ЗАПУЩЕНО!\n`,
					);
				} else if (data.message === "Auto update not due yet") {
					const nextRun = data.nextRun
						? new Date(data.nextRun).toLocaleTimeString("ru-RU")
						: "неизвестно";
					setLastBookWormReport(
						(prev) =>
							prev +
							`[${timestamp}] ℹ️ Авто-проверка: обновление не требуется. Следующий запуск: ${nextRun}\n`,
					);
				} else if (data.message === "Auto update is disabled") {
					setLastBookWormReport(
						(prev) =>
							prev + `[${timestamp}] ℹ️ Авто-проверка: обновление отключено.\n`,
					);
				} else {
					setLastBookWormReport(
						(prev) =>
							prev +
							`[${timestamp}] ℹ️ Результат авто-проверки: ${data.message}\n`,
					);
				}

				console.log("Auto update check completed:", data);
			} else {
				console.error("Auto update check failed:", response.statusText);
				const timestamp = new Date().toLocaleTimeString("ru-RU");
				setLastBookWormReport(
					(prev) =>
						prev +
						`[${timestamp}] ❌ Ошибка авто-проверки: ${response.statusText}\n`,
				);
			}
		} catch (error) {
			console.error("Error checking auto update:", error);
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			setLastBookWormReport(
				(prev) =>
					prev +
					`[${timestamp}] ❌ Ошибка выполнения авто-проверки: ${(error as Error).message}\n`,
			);
		}
	}, [bookWormAutoUpdate, supabase.auth]);

	// Устанавливаем интервал для проверки автообновления (резервный вариант, если GitHub Actions не настроен)
	useEffect(() => {
		if (bookWormAutoUpdate) {
			// Проверяем автообновление каждые 30 минут как резервный вариант (GitHub Actions обычно используется для основного автообновления)
			const interval = setInterval(
				checkAutoUpdate,
				Math.max(30, bookWormInterval) * 60 * 1000,
			);

			return () => {
				clearInterval(interval);
			};
		}
	}, [bookWormAutoUpdate, bookWormInterval, checkAutoUpdate]);

	// Функции для интерактивного поиска файлов
	// const handleStartInteractiveSearch = () => {
	//   // Здесь будет логика запуска интерактивного поиска
	//   console.log('Начать интерактивный поиск');
	// };

	// const handleResetInteractiveSearch = () => {
	//   setInteractiveSearchState({
	//     status: 'idle',
	//     message: ''
	//   });
	// };

	// Функция для запуска "Книжного Червя"
	const handleRunBookWorm = async (mode: "full" | "update") => {
		setBookWormRunning(true);
		setBookWormMode(mode);
		setError(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				router.push("/auth/login");
				return;
			}

			// Создаем отчет о запуске
			const report = `🔄 Запуск синхронизации в режиме ${mode === "full" ? "ПОЛНОЙ СИНХРОНИЗАЦИИ" : "ОБНОВЛЕНИЯ"}...\n\n`;
			setLastBookWormReport(report);

			// Для полной синхронизации используем новый dedicated endpoint
			const endpoint =
				mode === "full"
					? "/api/admin/book-worm/full-sync"
					: "/api/admin/book-worm";

			// Вызываем API endpoint для запуска синхронизации
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ mode }),
			});

			const data = await response.json();

			if (response.ok) {
				// Если это режим обновления, отображаем подробный отчет
				if (mode === "update" && data.result) {
					// Используем отформатированное сообщение из API, если оно есть
					const detailedReport =
						data.formattedMessage ||
						data.report ||
						`🔄 Результаты работы синхронизации в режиме ОБНОВЛЕНИЯ:\n` +
							`=====================================================\n\n` +
							`📚 Метаданные:\n` +
							`   ✅ Обработано: ${data.result.metadata?.processed || 0}\n` +
							`   ➕ Добавлено: ${data.result.metadata?.added || 0}\n` +
							`   🔄 Обновлено: ${data.result.metadata?.updated || 0}\n` +
							`   ⚠️  Пропущено: ${data.result.metadata?.skipped || 0}\n` +
							`   ❌ Ошибок: ${data.result.metadata?.errors || 0}\n\n` +
							`📁 Файлы:\n` +
							`   ✅ Обработано: ${data.result.files?.processed || 0}\n` +
							`   🔗 Привязано: ${data.result.files?.linked || 0}\n` +
							`   ⚠️  Пропущено: ${data.result.files?.skipped || 0}\n` +
							`   ❌ Ошибок: ${data.result.files?.errors || 0}\n\n` +
							`📊 Сводка:\n` +
							`   Всего обработано элементов: ${(data.result.metadata?.processed || 0) + (data.result.files?.processed || 0)}\n` +
							`   Успешных операций: ${(data.result.metadata?.added || 0) + (data.result.metadata?.updated || 0) + (data.result.files?.linked || 0)}\n` +
							`   Ошибок: ${(data.result.metadata?.errors || 0) + (data.result.files?.errors || 0)}`;

					setLastBookWormReport(detailedReport);
				} else {
					// Для полной синхронизации или других случаев
					const finalReport =
						data.formattedMessage ||
						`${report}✅ Синхронизация успешно запущена в режиме ${mode}!\n📊 Статус: ${data.message}\n🆔 Process ID: ${data.pid || "N/A"}`;
					setLastBookWormReport(finalReport);
				}

				// Обновляем статус
				// setBookWormStatus({
				//   status: 'completed',
				//   message: `Завершена в режиме ${mode}`,
				//   progress: 100
				// });
			} else {
				throw new Error(data.error || "Ошибка запуска синхронизации");
			}
		} catch (error) {
			console.error("Sync error:", error);
			setError(
				`Ошибка при выполнении синхронизации: ${(error as Error).message}`,
			);
			// Обновляем отчет об ошибке
			const errorReport = `🔄 Запуск синхронизации в режиме ${mode === "full" ? "ПОЛНОЙ СИНХРОНИЗАЦИИ" : "ОБНОВЛЕНИЯ"}...\n\n❌ Ошибка: ${(error as Error).message}`;
			setLastBookWormReport(errorReport);

			// Обновляем статус
			// setBookWormStatus({
			//   status: 'error',
			//   message: `Ошибка: ${(error as Error).message}`,
			//   progress: 0
			// });
		} finally {
			setBookWormRunning(false);
			setBookWormMode(null);
			// Обновляем панель результатов
			setSyncRefreshTrigger((prev) => prev + 1);
		}
	};

	// Функция для проверки статуса синхронизации
	const checkBookWormStatus = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				return;
			}

			const response = await fetch("/api/admin/book-worm/status", {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				const timestamp = new Date().toLocaleTimeString("ru-RU");

				if (data.active) {
					if (!bookWormRunning) {
						// Процесс только что обнаружен
						const message =
							typeof data.message === "string" ? data.message : "Выполняется";
						setLastBookWormReport(
							(prev) =>
								prev +
								`[${timestamp}] 🔄 Обнаружен активный процесс синхронизации (${message})...\n`,
						);
					}
					setBookWormRunning(true);
				} else if (bookWormRunning) {
					// Если синхронизация была активна, но теперь не активна - значит завершилась
					setLastBookWormReport(
						(prev) => prev + `[${timestamp}] ✅ Синхронизация завершена.\n`,
					);
					setBookWormRunning(false);
				}
			}
		} catch (error) {
			console.error("Error checking sync status:", error);
		}
	}, [supabase.auth, bookWormRunning]);

	// Периодически проверяем статус синхронизации
	useEffect(() => {
		const interval = setInterval(checkBookWormStatus, 5000);
		return () => clearInterval(interval);
	}, [checkBookWormStatus]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<Library className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
					<p className="text-muted-foreground">Загрузка админ панели...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle className="flex items-center text-destructive">
							<AlertCircle className="mr-2" />
							Ошибка
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">{error}</p>
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
			<div className="flex h-screen bg-background overflow-hidden">
				{/* Desktop Sidebar */}
				<AppSidebar
					user={user}
					userProfile={userProfile}
					onLogout={handleLogout}
				/>

				<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
					{/* Mobile Header */}
					<header className="lg:hidden flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-xl sticky top-0 z-30">
						<div className="flex items-center gap-2">
							<Library className="h-6 w-6 text-primary" />
							<span className="font-bold text-lg">FictionLib</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setMobileMenuOpen(true)}
						>
							<Menu className="h-6 w-6" />
						</Button>
					</header>

					{/* Mobile Menu Overlay */}
					{mobileMenuOpen && (
						<div className="fixed inset-0 z-50 lg:hidden bg-background/80 backdrop-blur-sm">
							<div className="fixed inset-y-0 left-0 w-72 bg-card border-r shadow-2xl p-0 flex flex-col">
								<div className="flex items-center justify-end p-4">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setMobileMenuOpen(false)}
									>
										<X className="h-6 w-6" />
									</Button>
								</div>
								<div className="flex-1 overflow-y-auto">
									<AppSidebar
										user={user}
										userProfile={userProfile}
										onLogout={handleLogout}
									/>
								</div>
							</div>
							<div
								className="flex-1"
								onClick={() => setMobileMenuOpen(false)}
							/>
						</div>
					)}

					<main className="flex-1 overflow-y-auto scrollbar-hide p-6">
						<div className="container mx-auto max-w-6xl">
							<div className="flex items-center justify-between mb-8">
								<h1 className="text-3xl font-bold tracking-tight">
									Админ панель
								</h1>
								<ThemeToggle />
							</div>

							<div className="space-y-6">
								{/* Telegram Stats */}
								<TelegramStatsSection />

								{/* Синхронизация */}
								<SyncSettingsShadix
									bookWormRunning={bookWormRunning}
									bookWormMode={bookWormMode}
									bookWormInterval={bookWormInterval}
									bookWormAutoUpdate={bookWormAutoUpdate}
									handleRunBookWorm={handleRunBookWorm}
									handleToggleAutoUpdate={handleToggleAutoUpdate}
									setBookWormInterval={setBookWormInterval}
								/>

								{/* Индексация файлов Telegram */}
								<TelegramFilesIndexer />

								{/* История синхронизаций */}
								<SyncResultsPanel refreshTrigger={syncRefreshTrigger} />
							</div>
						</div>
					</main>
				</div>
			</div>
		</PageTransition>
	);
}
