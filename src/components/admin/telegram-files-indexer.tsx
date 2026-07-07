"use client";

import { Database, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	const [error, setError] = useState<string | null>(null);

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

	useEffect(() => {
		loadStats();
	}, [loadStats]);

	const handleIndex = async () => {
		setIsIndexing(true);
		setError(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				setError("Не авторизован");
				return;
			}

			const response = await fetch("/api/admin/telegram-files/index", {
				method: "POST",
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			const data: IndexResult = await response.json();

			if (data.success) {
				await loadStats();
			} else {
				setError(data.error || "Неизвестная ошибка");
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
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center justify-between gap-3 text-sm">
					<span className="flex items-center gap-2">
						<Database className="size-4 text-muted-foreground" />
						Индексация файлов Telegram
					</span>
					<Button
						onClick={handleIndex}
						disabled={isIndexing}
						className="h-8 gap-1.5"
						size="sm"
					>
						{isIndexing ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<RefreshCw className="size-3.5" />
						)}
						{isIndexing ? "Идет" : "Обновить"}
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 pt-0">
				{stats && (
					<div className="grid grid-cols-2 gap-2">
						<div className="rounded-md border bg-muted/40 p-2">
							<div className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
								Файлы
							</div>
							<div className="mt-1 font-semibold text-sm">
								{stats.total_files.toLocaleString()}
							</div>
						</div>
						<div className="rounded-md border bg-muted/40 p-2">
							<div className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
								Индекс
							</div>
							<div className="mt-1 truncate font-medium text-xs">
								{formatDate(stats.last_indexed_at)}
							</div>
						</div>
					</div>
				)}

				{error && (
					<div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
						{error}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
