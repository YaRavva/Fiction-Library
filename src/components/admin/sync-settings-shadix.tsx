"use client";

import { Database, RotateCcw, Search, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
					enabled,
					interval,
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
		saveAutoUpdateSettings(newChecked, timerValue);
	};

	const handleTimerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = Math.max(
			5,
			Math.min(1440, Number.parseInt(e.target.value, 10) || 30),
		);
		setTimerValue(newValue);
		setBookWormInterval(newValue);

		if (autoUpdateEnabled) {
			saveAutoUpdateSettings(autoUpdateEnabled, newValue);
		}
	};

	if (initialLoad) {
		return (
			<Card className="min-h-[224px] rounded-lg shadow-sm">
				<CardContent className="flex h-full min-h-[224px] items-center justify-center">
					<div className="text-muted-foreground text-sm">
						Загрузка настроек...
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="min-h-[224px] rounded-lg shadow-sm">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2">
					<RotateCcw className="h-5 w-5" />
					Синхронизация контента
				</CardTitle>
				<CardDescription>
					Управление загрузкой книг и файлов из Telegram
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6 pt-0">
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap gap-3">
						<Button
							onClick={() => handleRunBookWorm("full")}
							disabled={bookWormRunning && bookWormMode === "full"}
							size="default"
							title="Полная синхронизация"
							className="min-w-[140px] flex-1"
						>
							<Database className="mr-2 h-4 w-4" />
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
							className="min-w-[140px] flex-1"
						>
							<RotateCcw className="mr-2 h-4 w-4" />
							{bookWormRunning && bookWormMode === "update"
								? "Обновление..."
								: "Обновление"}
						</Button>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="auto-update"
								checked={autoUpdateEnabled}
								onCheckedChange={handleAutoUpdateChange}
							/>
							<label
								htmlFor="auto-update"
								className="cursor-pointer select-none font-medium text-sm leading-none"
							>
								Автообновление
							</label>
						</div>
						<div className="flex items-center gap-2">
							<Label
								htmlFor="book-worm-interval"
								className="whitespace-nowrap font-medium text-sm"
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
								className="h-8 w-20 font-mono text-sm"
							/>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

interface AdminToolCardsProps {
	className?: string;
}

export function AdminToolCards({ className }: AdminToolCardsProps) {
	const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

	return (
		<div className={cn("grid gap-6", className)}>
			<Card className="min-h-[100px] rounded-lg shadow-sm">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2">
						<Search className="h-4 w-4" />
						Ручной поиск файлов
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<FileSearchManager />
				</CardContent>
			</Card>

			<Card className="h-full min-h-[100px] rounded-lg shadow-sm">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2">
						<Trash2 className="h-4 w-4" />
						Управление дубликатами
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<Button
						onClick={() => setShowDuplicatesModal(true)}
						variant="destructive"
						size="default"
						className="w-full"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Управление дубликатами (Mod)
					</Button>
				</CardContent>
			</Card>

			<DuplicatesResolverModal
				isOpen={showDuplicatesModal}
				onClose={() => setShowDuplicatesModal(false)}
			/>
		</div>
	);
}
