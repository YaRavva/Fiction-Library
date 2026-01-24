"use client";

import { RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { FileSearchManager } from "./file-search-manager";

interface SyncSettingsProps {
	bookWormRunning: boolean;
	bookWormMode: "full" | "update" | null;
	bookWormInterval: number;
	bookWormAutoUpdate: boolean;
	handleRunBookWorm: (mode: "full" | "update") => void;
	handleToggleAutoUpdate: (checked: boolean) => void;
	setBookWormInterval: (interval: number) => void;
}

export function SyncSettings({
	bookWormRunning,
	bookWormMode,
	bookWormInterval,
	bookWormAutoUpdate,
	handleRunBookWorm,
	handleToggleAutoUpdate,
	setBookWormInterval,
}: SyncSettingsProps) {
	const [supabase] = useState(() => getBrowserSupabase());
	const [autoUpdateEnabled, setAutoUpdateEnabled] =
		useState(bookWormAutoUpdate);
	const [timerValue, setTimerValue] = useState(bookWormInterval);
	const [initialLoad, setInitialLoad] = useState(true); // Флаг для определения первоначальной загрузки
	const [searching, setSearching] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Загружаем настройки автообновления при монтировании компонента
	useEffect(() => {
		loadAutoUpdateSettings();
	}, [loadAutoUpdateSettings]);

	// Обновляем состояние при изменениях извне (только после первоначальной загрузки)
	useEffect(() => {
		if (!initialLoad) {
			setAutoUpdateEnabled(bookWormAutoUpdate);
			setTimerValue(bookWormInterval);
		}
	}, [bookWormAutoUpdate, bookWormInterval, initialLoad]);

	const loadAutoUpdateSettings = async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/book-worm/auto-update", {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			if (response.ok) {
				const { settings } = await response.json();
				if (settings) {
					setAutoUpdateEnabled(settings.enabled);
					setTimerValue(settings.interval);
					// Обновляем родительские состояния
					handleToggleAutoUpdate(settings.enabled);
					setBookWormInterval(settings.interval);
				}
			} else {
				console.error(
					"Failed to load auto update settings:",
					response.statusText,
				);
			}
		} catch (error) {
			console.error("Error loading auto update settings:", error);
		} finally {
			setInitialLoad(false); // Устанавливаем флаг после загрузки
		}
	};

	const saveAutoUpdateSettings = async (enabled: boolean, interval: number) => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/book-worm/auto-update", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({
					enabled: enabled,
					interval: interval,
				}),
			});

			if (!response.ok) {
				console.error(
					"Failed to save auto update settings:",
					response.statusText,
				);
				// Вызываем alert или показываем ошибку пользователю
				alert(
					`Ошибка сохранения настроек автообновления: ${response.statusText}`,
				);
			} else {
				console.log("Auto update settings saved successfully");
			}
		} catch (error) {
			console.error("Error saving auto update settings:", error);
			alert("Ошибка соединения при сохранении настроек автообновления");
		}
	};

	const handleAutoUpdateChange = (checked: boolean) => {
		const newChecked = Boolean(checked);
		setAutoUpdateEnabled(newChecked);
		handleToggleAutoUpdate(newChecked);

		// Сохраняем изменения в базу данных только при изменении состояния чекбокса
		saveAutoUpdateSettings(newChecked, timerValue);
	};

	const handleTimerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = Math.max(
			5,
			Math.min(1440, Number.parseInt(e.target.value, 10) || 30),
		);
		setTimerValue(newValue);
		setBookWormInterval(newValue);

		// Сохраняем изменения в базу данных ТОЛЬКО если автообновление включено
		if (autoUpdateEnabled) {
			saveAutoUpdateSettings(autoUpdateEnabled, newValue);
		}
	};

	const handleSearchDuplicates = async () => {
		try {
			setError(null);
			setSearching(true);

			const session = await supabase.auth.getSession();
			if (!session.data.session) {
				throw new Error("Сессия не найдена");
			}

			// Показываем начальный прогресс в результатах
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const progressReport = `[${timestamp}] 🔍 Начат поиск дубликатов книг...\n`;

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(progressReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			const response = await fetch("/api/admin/duplicates", {
				headers: {
					Authorization: `Bearer ${session.data.session.access_token}`,
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Отправляем результаты в окно результатов
			const resultTimestamp = new Date().toLocaleTimeString("ru-RU");
			let resultReport = `[${resultTimestamp}] ✅ Поиск дубликатов завершен!\n`;
			resultReport += `📊 Найдено ${data.duplicateGroups.length} групп потенциальных дубликатов\n`;
			resultReport += `💡 Потенциальных дубликатов: ${data.stats.potentialDuplicates}\n`;
			resultReport += `📈 Примерное количество уникальных книг: ${data.stats.uniqueBooksEstimate}\n`;

			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(resultReport);
				} catch (error) {
					console.error("❌ Error sending results to window:", error);
				}
			}
		} catch (err) {
			console.error("Error searching duplicates:", err);
			setError(`Ошибка при поиске дубликатов: ${(err as Error).message}`);

			// Отправляем ошибку в окно результатов
			const errorTimestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${errorTimestamp}] ❌ Ошибка поиска дубликатов: ${(err as Error).message}\n`;

			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(errorReport);
				} catch (error) {
					console.error("❌ Error sending error to results window:", error);
				}
			}
		} finally {
			setSearching(false);
		}
	};

	const handleRemoveDuplicates = async () => {
		try {
			setError(null);
			setRemoving(true);

			const session = await supabase.auth.getSession();
			if (!session.data.session) {
				throw new Error("Сессия не найдена");
			}

			// Показываем начальный прогресс в результатах
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const progressReport = `[${timestamp}] 🗑️ Начато удаление дубликатов книг...\n`;

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(progressReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			const response = await fetch("/api/admin/duplicates", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.data.session.access_token}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Отправляем результаты в окно результатов
			const resultTimestamp = new Date().toLocaleTimeString("ru-RU");
			let resultReport = `[${resultTimestamp}] ✅ Удаление дубликатов завершено!\n`;
			resultReport += `📊 Удалено: ${data.deletedCount} книг\n`;
			if (data.totalErrors > 0) {
				resultReport += `⚠️ Ошибок: ${data.totalErrors}\n`;
			}
			resultReport += `📋 ${data.message}\n`;

			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(resultReport);
				} catch (error) {
					console.error("❌ Error sending results to window:", error);
				}
			}
		} catch (err) {
			console.error("Error removing duplicates:", err);
			setError(`Ошибка при удалении дубликатов: ${(err as Error).message}`);

			// Отправляем ошибку в окно результатов
			const errorTimestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${errorTimestamp}] ❌ Ошибка удаления дубликатов: ${(err as Error).message}\n`;

			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(errorReport);
				} catch (error) {
					console.error("❌ Error sending error to results window:", error);
				}
			}
		} finally {
			setRemoving(false);
		}
	};

	return (
		<div className="w-full p-6">
			<div className="w-full space-y-4">
				<h1 className="text-2xl font-semibold tracking-tight">Синхронизация</h1>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-2 items-start justify-center">
					{/* Синхронизация книг и файлов */}
					<div className="space-y-3 w-full">
						<h2 className="text-base font-medium">
							Синхронизация книг и файлов
						</h2>

						<div className="space-y-3">
							<div className="flex flex-wrap items-center gap-4">
								<Button
									onClick={() => handleRunBookWorm("full")}
									disabled={bookWormRunning && bookWormMode === "full"}
									size="default"
								>
									{bookWormRunning && bookWormMode === "full"
										? "Выполняется..."
										: "Полная"}
								</Button>

								<Button
									onClick={() => handleRunBookWorm("update")}
									disabled={bookWormRunning && bookWormMode === "update"}
									variant="outline"
									size="default"
								>
									{bookWormRunning && bookWormMode === "update"
										? "Обновление..."
										: "Обновление"}
								</Button>
							</div>

							<div className="flex flex-wrap items-center gap-3">
								<div className="flex items-center gap-2">
									<Label
										htmlFor="book-worm-interval"
										className="text-sm font-medium whitespace-nowrap"
									>
										Таймер:
									</Label>
									<Input
										id="book-worm-interval"
										type="number"
										min="5"
										max="1440"
										value={timerValue}
										onChange={handleTimerChange}
										className="w-20 h-9 text-sm font-mono"
									/>
									<span className="text-sm text-muted-foreground font-medium">
										мин
									</span>
								</div>

								<div className="flex items-center gap-2">
									<Checkbox
										id="auto-update"
										checked={autoUpdateEnabled}
										onCheckedChange={handleAutoUpdateChange}
									/>
									<label
										htmlFor="auto-update"
										className="text-sm font-medium leading-none cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Автообновление
									</label>
								</div>
							</div>
						</div>
					</div>

					{/* Полуавтоматический поиск файлов */}
					<div className="space-y-3 w-full">
						<h2 className="text-base font-medium">
							Полуавтоматический поиск файлов
						</h2>
						<FileSearchManager />
					</div>

					{/* Поиск и удаление дубликатов */}
					<div className="space-y-3 w-full">
						<h2 className="text-base font-medium">
							Поиск и удаление дубликатов
						</h2>
						<div className="space-y-3 w-full">
							<div className="flex flex-wrap items-center gap-4">
								<Button
									onClick={handleSearchDuplicates}
									disabled={searching || removing}
									size="default"
								>
									{searching ? (
										<>
											<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
											Поиск...
										</>
									) : (
										<>
											<Search className="h-4 w-4 mr-2" />
											Поиск дубликатов
										</>
									)}
								</Button>

								<Button
									onClick={handleRemoveDuplicates}
									disabled={searching || removing}
									variant="outline"
									size="default"
								>
									{removing ? (
										<>
											<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
											Удаление...
										</>
									) : (
										<>
											<Trash2 className="h-4 w-4 mr-2" />
											Удалить дубликаты
										</>
									)}
								</Button>
							</div>

							{error && (
								<div className="text-destructive text-sm p-2 bg-destructive/10 rounded">
									{error}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
