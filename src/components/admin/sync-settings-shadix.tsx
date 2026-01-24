"use client";

import { Database, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { DuplicatesResolverModal } from "./duplicates-resolver-modal";
import { FileSearchManager } from "./file-search-manager";

interface SyncSettingsShadixProps {
	bookWormRunning: boolean;
	bookWormMode: "full" | "update" | null;
	bookWormInterval: number;
	bookWormAutoUpdate: boolean;
	handleRunBookWorm: (mode: "full" | "update") => void;
	handleToggleAutoUpdate: (checked: boolean) => void;
	setBookWormInterval: (interval: number) => void;
}

export function SyncSettingsShadix({
	bookWormRunning,
	bookWormMode,
	bookWormInterval,
	bookWormAutoUpdate,
	handleRunBookWorm,
	handleToggleAutoUpdate,
	setBookWormInterval,
}: SyncSettingsShadixProps) {
	const [supabase] = useState(() => getBrowserSupabase());
	const [autoUpdateEnabled, setAutoUpdateEnabled] =
		useState(bookWormAutoUpdate);
	const [timerValue, setTimerValue] = useState(bookWormInterval);
	const [initialLoad, setInitialLoad] = useState(true);
	// const [searching, setSearching] = useState(false);
	// const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

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
			setInitialLoad(false);
		}
	};

	// Загружаем настройки автообновления при монтировании компонента
	useEffect(() => {
		loadAutoUpdateSettings();
	}, [supabase, handleToggleAutoUpdate, setBookWormInterval]);

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
				throw new Error(
					`Failed to save auto update settings: ${response.statusText}`,
				);
			}

			return { message: "Настройки автообновления сохранены", error: false };
		} catch (error) {
			console.error("Error saving auto update settings:", error);
			return {
				message: `Ошибка сохранения настроек: ${(error as Error).message}`,
				error: true,
			};
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

	// Action Button handlers removed (direct calls used)

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
				{/* Основная синхронизация */}
				<Card className="h-full">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<RotateCcw className="h-5 w-5" />
							Синхронизация контента
						</CardTitle>
						<CardDescription>
							Управление загрузкой книг и файлов из Telegram
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex flex-col gap-4">
							<div className="flex flex-wrap gap-3">
								<div className="flex flex-wrap gap-3">
									<Button
										onClick={() => handleRunBookWorm("full")}
										disabled={bookWormRunning && bookWormMode === "full"}
										size="default"
										title="Полная синхронизация"
										className="flex-1 min-w-[140px]"
									>
										<Database className="h-4 w-4 mr-2" />
										{bookWormRunning && bookWormMode === "full"
											? "Выполняется..."
											: "Полная"}
									</Button>

									<Button
										onClick={() => handleRunBookWorm("update")}
										disabled={bookWormRunning && bookWormMode === "update"}
										variant="outline"
										size="default"
										title="Обновление библиотеки"
										className="flex-1 min-w-[140px]"
									>
										<RotateCcw className="h-4 w-4 mr-2" />
										{bookWormRunning && bookWormMode === "update"
											? "Обновление..."
											: "Обновление"}
									</Button>
								</div>
							</div>

							<div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
								<div className="flex items-center gap-4">
									<div className="flex items-center space-x-2">
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

								<div className="flex items-center gap-2">
									<Label
										htmlFor="book-worm-interval"
										className="text-sm font-medium whitespace-nowrap"
									>
										Интервал (мин):
									</Label>
									<Input
										id="book-worm-interval"
										type="number"
										min="5"
										max="1440"
										value={timerValue}
										onChange={handleTimerChange}
										className="w-20 h-8 text-sm font-mono"
									/>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Дополнительные инструменты */}
				<div className="grid grid-cols-1 gap-6">
					{/* Поиск файлов */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold flex items-center gap-2">
								<Search className="h-4 w-4" />
								Ручной поиск файлов
							</CardTitle>
						</CardHeader>
						<CardContent>
							<FileSearchManager />
						</CardContent>
					</Card>

					{/* Дубликаты */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold flex items-center gap-2">
								<Trash2 className="h-4 w-4" />
								Управление дубликатами
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex flex-wrap gap-3">
									<Button
										onClick={() => setShowDuplicatesModal(true)}
										variant="destructive"
										size="default"
										className="flex-1"
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Управление дубликатами (Mod)
									</Button>
								</div>

								{error && (
									<div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md flex items-center gap-2">
										<div className="h-2 w-2 rounded-full bg-destructive" />
										{error}
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<DuplicatesResolverModal
				isOpen={showDuplicatesModal}
				onClose={() => setShowDuplicatesModal(false)}
			/>
		</div>
	);
}
