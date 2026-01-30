"use client";

import { Database, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getBrowserSupabase } from "@/lib/browserSupabase";

interface IndexStats {
	total_files: number;
	last_indexed_at: string | null;
}

interface IndexResult {
	success: boolean;
	stats?: {
		total_messages: number;
		total_files: number;
		skipped: number;
		inserted: number;
		errors: number;
		duration_seconds: number;
	};
	logs?: string[];
	error?: string;
}

export function TelegramFilesIndexer() {
	const [supabase] = useState(() => getBrowserSupabase());
	const [isIndexing, setIsIndexing] = useState(false);
	const [stats, setStats] = useState<IndexStats | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);

	// Загрузка статистики индекса
	const loadStats = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/telegram-files/index", {
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			if (response.ok) {
				const data = await response.json();
				setStats(data);
			}
		} catch (err) {
			console.error("Error loading stats:", err);
		}
	}, [supabase]);

	// Загрузка статистики при монтировании
	useEffect(() => {
		loadStats();
	}, [loadStats]);

	// Запуск индексации
	const handleIndex = async () => {
		setIsIndexing(true);
		setLogs([]);
		setError(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				setError("Не авторизован");
				return;
			}

			setLogs(["🚀 Запуск индексации файлов из Telegram..."]);

			const response = await fetch("/api/admin/telegram-files/index", {
				method: "POST",
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			const data: IndexResult = await response.json();

			if (data.success) {
				setLogs(data.logs || []);
				await loadStats();
			} else {
				setError(data.error || "Неизвестная ошибка");
				setLogs(data.logs || []);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsIndexing(false);
		}
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "Никогда";
		return new Date(dateStr).toLocaleString("ru-RU");
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Database className="h-5 w-5" />
					Индексация файлов Telegram
				</CardTitle>
				<CardDescription>
					Загрузка метаданных файлов из Telegram канала в базу данных для
					быстрого поиска
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Статистика */}
				{stats && (
					<div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
						<div>
							<div className="text-sm text-muted-foreground">
								Файлов в индексе
							</div>
							<div className="text-2xl font-bold">
								{stats.total_files.toLocaleString()}
							</div>
						</div>
						<div>
							<div className="text-sm text-muted-foreground">
								Последняя индексация
							</div>
							<div className="text-sm font-medium">
								{formatDate(stats.last_indexed_at)}
							</div>
						</div>
					</div>
				)}

				{/* Кнопка индексации */}
				<Button
					onClick={handleIndex}
					disabled={isIndexing}
					className="w-full"
					size="lg"
				>
					{isIndexing ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Индексация...
						</>
					) : (
						<>
							<RefreshCw className="h-4 w-4 mr-2" />
							Запустить индексацию
						</>
					)}
				</Button>

				{/* Ошибки */}
				{error && (
					<div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
						❌ {error}
					</div>
				)}

				{/* Лог */}
				{logs.length > 0 && (
					<div className="space-y-2">
						<div className="text-sm font-medium">Лог индексации:</div>
						<div className="bg-black text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
							{logs.map((log, i) => (
								<div key={i}>{log}</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
