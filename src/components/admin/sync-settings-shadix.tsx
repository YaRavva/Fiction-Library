"use client";

import { Database, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { EmbeddingProgress } from "./embedding-progress";

interface SyncSettingsShadixProps {
	bookWormRunning: boolean;
	bookWormMode: "full" | "update" | null;
	handleRunBookWorm: (mode: "full" | "update") => void;
}

export function SyncSettingsShadix({
	bookWormRunning,
	bookWormMode,
	handleRunBookWorm,
}: SyncSettingsShadixProps) {
	return (
		<Card className="h-full min-h-[224px] rounded-lg shadow-sm">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2">
					<RotateCcw className="size-4" />
					Синхронизация контента
				</CardTitle>
				<CardDescription>
					Загрузка книг и файлов из Telegram
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="grid gap-3 sm:grid-cols-2">
					<Button
						onClick={() => handleRunBookWorm("full")}
						disabled={bookWormRunning && bookWormMode === "full"}
						className="w-full"
					>
						<Database className="mr-2 size-4" />
						{bookWormRunning && bookWormMode === "full"
							? "Выполняется..."
							: "Полная"}
					</Button>
					<Button
						onClick={() => handleRunBookWorm("update")}
						disabled={bookWormRunning && bookWormMode === "update"}
						variant="outline"
						className="w-full"
					>
						<RotateCcw className="mr-2 size-4" />
						{bookWormRunning && bookWormMode === "update"
							? "Обновление..."
							: "Обновление"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

interface AutomationSettingsCardProps {
	bookWormAutoUpdate: boolean;
	bookWormInterval: number;
	handleToggleAutoUpdate: (checked: boolean) => void;
	setBookWormInterval: (interval: number) => void;
}

function AutomationSettingsCard({
	bookWormAutoUpdate,
	bookWormInterval,
	handleToggleAutoUpdate,
	setBookWormInterval,
}: AutomationSettingsCardProps) {
	const [supabase] = useState(() => getBrowserSupabase());
	const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(bookWormAutoUpdate);
	const [timerValue, setTimerValue] = useState(bookWormInterval);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const saveSettings = useCallback(
		async (enabled: boolean, interval: number) => {
			try {
				setError(null);
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
					body: JSON.stringify({ enabled, interval }),
				});

				if (!response.ok) {
					throw new Error("Не удалось сохранить настройки автообновления");
				}
			} catch (saveError) {
				console.error("Error saving auto update settings:", saveError);
				setError(
					saveError instanceof Error
						? saveError.message
						: "Не удалось сохранить настройки автообновления",
				);
			}
		},
		[supabase],
	);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session) return;

				const response = await fetch("/api/admin/book-worm/auto-update", {
					headers: { Authorization: `Bearer ${session.access_token}` },
				});
				if (!response.ok) throw new Error("Не удалось загрузить настройки");

				const { settings } = await response.json();
				if (!settings) return;

				setAutoUpdateEnabled(settings.enabled);
				setTimerValue(settings.interval);
				handleToggleAutoUpdate(settings.enabled);
				setBookWormInterval(settings.interval);
			} catch (loadError) {
				console.error("Error loading auto update settings:", loadError);
				setError("Не удалось загрузить настройки автообновления");
			} finally {
				setLoading(false);
			}
		};

		loadSettings();
	}, [handleToggleAutoUpdate, setBookWormInterval, supabase]);

	const handleAutoUpdateChange = (checked: boolean) => {
		setAutoUpdateEnabled(checked);
		handleToggleAutoUpdate(checked);
		saveSettings(checked, timerValue);
	};

	const handleTimerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const interval = Math.max(
			5,
			Math.min(1440, Number.parseInt(event.target.value, 10) || 30),
		);
		setTimerValue(interval);
		setBookWormInterval(interval);
		if (autoUpdateEnabled) saveSettings(autoUpdateEnabled, interval);
	};

	return (
		<Card className="min-h-[224px] rounded-lg shadow-sm">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2">
					<Settings2 className="size-4" />
					Обновления и эмбеддинги
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 pt-0">
				<div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
					<div className="space-y-1">
						<Label htmlFor="auto-update" className="font-medium text-sm">
							Автообновление
						</Label>
						<p className="text-muted-foreground text-xs">
							Автоматическая проверка новых книг и файлов.
						</p>
					</div>
					<Checkbox
						id="auto-update"
						checked={autoUpdateEnabled}
						disabled={loading}
						onCheckedChange={(checked) =>
							handleAutoUpdateChange(checked === true)
						}
					/>
				</div>
				<div className="flex items-center justify-between gap-3">
					<Label htmlFor="book-worm-interval" className="font-medium text-sm">
						Интервал проверки, мин.
					</Label>
					<Input
						id="book-worm-interval"
						type="number"
						min="5"
						max="1440"
						value={timerValue}
						disabled={loading}
						onChange={handleTimerChange}
						className="h-8 w-20 font-mono text-sm"
					/>
				</div>
				<div className="border-t pt-4">
					<EmbeddingProgress showControls />
				</div>
				{error ? (
					<p className="text-destructive text-xs">{error}</p>
				) : null}
			</CardContent>
		</Card>
	);
}

interface AdminToolCardsProps extends AutomationSettingsCardProps {
	className?: string;
}

export function AdminToolCards({
	className,
	...automationProps
}: AdminToolCardsProps) {
	const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

	return (
		<div className={cn("grid gap-6", className)}>
			<AutomationSettingsCard {...automationProps} />
			<Card className="h-full min-h-[100px] rounded-lg shadow-sm">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2">
						<Trash2 className="size-4" />
						Управление дубликатами
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<Button
						onClick={() => setShowDuplicatesModal(true)}
						variant="destructive"
						className="w-full"
					>
						<Trash2 className="mr-2 size-4" />
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
