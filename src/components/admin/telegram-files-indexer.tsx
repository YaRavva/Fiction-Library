"use client";

import { Brain, Database, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

interface EmbeddingStats {
	files: {
		total: number;
		embedded: number;
		pending: number;
	};
	schema?: {
		filesEmbeddingReady: boolean;
	};
}

export function TelegramFilesIndexer() {
	const [supabase] = useState(() => getBrowserSupabase());
	const [isIndexing, setIsIndexing] = useState(false);
	const [stats, setStats] = useState<IndexStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Embedding state
	const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(
		null,
	);
	const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
	const [embeddingProgress, setEmbeddingProgress] = useState<{
		current: number;
		total: number;
		message: string;
	} | null>(null);
	const [embeddingError, setEmbeddingError] = useState<string | null>(null);

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

	const loadEmbeddingStats = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/embedding/stats", {
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			if (response.ok) {
				const data = await response.json();
				if (data.stats) {
					setEmbeddingStats(data.stats);
				}
			}
		} catch (err) {
			console.error("Error loading embedding stats:", err);
		}
	}, [supabase]);

	useEffect(() => {
		loadStats();
		loadEmbeddingStats();
	}, [loadStats, loadEmbeddingStats]);

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

	const handleGenerateEmbeddings = async () => {
		setIsGeneratingEmbeddings(true);
		setEmbeddingError(null);
		setEmbeddingProgress({ current: 0, total: 0, message: "Запуск..." });

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				setEmbeddingError("Не авторизован");
				return;
			}

			// Get initial stats
			const statsResponse = await fetch("/api/admin/embedding/stats", {
				headers: { Authorization: `Bearer ${session.access_token}` },
			});
			const statsData = await statsResponse.json();
			const pendingFiles = statsData.stats?.files?.pending || 0;

			if (pendingFiles === 0) {
				setEmbeddingProgress({
					current: 0,
					total: 0,
					message: "Все файлы уже имеют эмбеддинги",
				});
				setIsGeneratingEmbeddings(false);
				return;
			}

			setEmbeddingProgress({
				current: 0,
				total: pendingFiles,
				message: `Обработка 0/${pendingFiles} файлов...`,
			});

			// Process in batches
			let totalProcessed = 0;
			const batchSize = 150;

			while (totalProcessed < pendingFiles) {
				const response = await fetch("/api/admin/embeddings/generate", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${session.access_token}`,
					},
					body: JSON.stringify({
						batchSize,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Ошибка генерации эмбеддингов");
				}

				totalProcessed += data.files?.embedded || 0;

				setEmbeddingProgress({
					current: totalProcessed,
					total: pendingFiles,
					message: `Обработано ${totalProcessed}/${pendingFiles} файлов`,
				});

				// If no files were processed in this batch, we're done
				if (!data.files?.embedded || data.files.embedded === 0) {
					break;
				}
			}

			// Reload stats
			await loadEmbeddingStats();
			setEmbeddingProgress({
				current: totalProcessed,
				total: pendingFiles,
				message: `Готово: обработано ${totalProcessed} файлов`,
			});
		} catch (err) {
			setEmbeddingError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsGeneratingEmbeddings(false);
		}
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "Никогда";
		return new Date(dateStr).toLocaleString("ru-RU");
	};

	return (
		<Card className="min-h-[224px] rounded-lg shadow-sm">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center justify-between gap-3">
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
						<div className="rounded-md border bg-muted/40 p-3">
							<div className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
								Файлы
							</div>
							<div className="mt-1 font-semibold text-sm">
								{stats.total_files.toLocaleString()}
							</div>
						</div>
						<div className="rounded-md border bg-muted/40 p-3">
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

				{/* Embedding Section */}
				<div className="border-t pt-3">
					<div className="flex items-center justify-between gap-2 mb-2">
						<div className="flex items-center gap-2">
							<Brain className="size-4 text-muted-foreground" />
							<span className="text-sm font-medium">Эмбеддинги</span>
						</div>
						<Button
							onClick={handleGenerateEmbeddings}
							disabled={isGeneratingEmbeddings}
							className="h-7 gap-1.5"
							size="sm"
							variant="outline"
						>
							{isGeneratingEmbeddings ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<Brain className="size-3" />
							)}
							{isGeneratingEmbeddings ? "Генерация..." : "Создать"}
						</Button>
					</div>

					{embeddingStats && (
						<div className="grid grid-cols-2 gap-2 mb-2">
							<div className="rounded-md border bg-muted/40 p-2">
								<div className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
									С эмбеддингами
								</div>
								<div className="mt-0.5 font-semibold text-xs">
									{embeddingStats.files.embedded.toLocaleString()}
								</div>
							</div>
							<div className="rounded-md border bg-muted/40 p-2">
								<div className="text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
									Ожидают
								</div>
								<div className="mt-0.5 font-semibold text-xs">
									{embeddingStats.files.pending.toLocaleString()}
								</div>
							</div>
						</div>
					)}

					{embeddingProgress && isGeneratingEmbeddings && (
						<div className="space-y-2 rounded-md border bg-muted/30 p-2">
							<div className="flex items-center justify-between text-xs">
								<span>
									{embeddingProgress.current}/{embeddingProgress.total}
								</span>
								<span>
									{embeddingProgress.total > 0
										? Math.round(
												(embeddingProgress.current / embeddingProgress.total) *
													100,
											)
										: 0}
									%
								</span>
							</div>
							<Progress
								value={
									embeddingProgress.total > 0
										? Math.round(
												(embeddingProgress.current / embeddingProgress.total) *
													100,
											)
										: 0
								}
							/>
							<p className="text-muted-foreground text-xs">
								{embeddingProgress.message}
							</p>
						</div>
					)}

					{embeddingProgress && !isGeneratingEmbeddings && (
						<div className="rounded-md bg-emerald-500/10 p-2 text-emerald-700 text-xs dark:text-emerald-400">
							{embeddingProgress.message}
						</div>
					)}

					{embeddingError && (
						<div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
							{embeddingError}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
