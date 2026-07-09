"use client";

import { Brain, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEmbeddingPolling } from "@/hooks/useEmbeddingPolling";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { withRetry } from "@/lib/retry";

interface EmbeddingProgressProps {
	showControls?: boolean;
}

export function EmbeddingProgress({
	showControls = false,
}: EmbeddingProgressProps) {
	const [supabase] = useState(() => getBrowserSupabase());
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);

	const { stats, loading, error, isPolling, fetchStats, startPolling } =
		useEmbeddingPolling({
			pollInterval: 5000,
		});

	const filesTotal = stats?.files?.total ?? 0;
	const filesEmbedded = stats?.files?.embedded ?? 0;
	const filesPending = stats?.files?.pending ?? 0;
	const percentage =
		filesTotal > 0 ? Math.round((filesEmbedded / filesTotal) * 100) : 0;

	const isBackgroundGenerating = filesPending > 0 && filesEmbedded < filesTotal;

	// Auto-start polling when there are pending embeddings
	useEffect(() => {
		if (isBackgroundGenerating && !isPolling) {
			startPolling();
		}
	}, [isBackgroundGenerating, isPolling, startPolling]);

	const handleGenerate = useCallback(async () => {
		setIsGenerating(true);
		setGenerationError(null);

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) {
				setGenerationError("Не авторизован");
				return;
			}

			// Get pending files count
			const statsData = await withRetry(
				async () => {
					const statsResponse = await fetch("/api/admin/embedding/stats", {
						headers: { Authorization: `Bearer ${session.access_token}` },
					});
					if (!statsResponse.ok)
						throw new Error(`HTTP: ${statsResponse.status}`);
					return statsResponse.json();
				},
				{ maxRetries: 2 },
			);

			const pendingFiles = statsData.stats?.files?.pending || 0;
			if (pendingFiles === 0) {
				setIsGenerating(false);
				return;
			}

			// Process in batches
			let totalProcessed = 0;
			const batchSize = 150;

			while (totalProcessed < pendingFiles) {
				const data = await withRetry(
					async () => {
						const response = await fetch("/api/admin/embeddings/generate", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${session.access_token}`,
							},
							body: JSON.stringify({ batchSize }),
						});

						if (!response.ok) {
							const errorData = await response.json();
							throw new Error(
								errorData.error || "Ошибка генерации эмбеддингов",
							);
						}

						return response.json();
					},
					{
						maxRetries: 3,
						onRetry: (attempt, err) => {
							console.warn(
								`Embedding generation retry ${attempt}:`,
								err.message,
							);
						},
					},
				);

				totalProcessed += data.files?.embedded || 0;

				// If no files were processed in this batch, we're done
				if (!data.files?.embedded || data.files.embedded === 0) {
					break;
				}
			}

			// Reload stats
			await fetchStats();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setGenerationError(message);
			console.error("Error generating embeddings:", err);
		} finally {
			setIsGenerating(false);
		}
	}, [supabase, fetchStats]);

	const handleRefresh = useCallback(async () => {
		await fetchStats();
	}, [fetchStats]);

	if (loading && !stats) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2 className="size-4 animate-spin" />
				<span>Загрузка статистики...</span>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Brain className="size-4 text-purple-500" />
					<span className="text-sm font-medium">Эмбеддинги</span>
					{(isGenerating || isBackgroundGenerating) && (
						<span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 text-xs dark:bg-purple-900/30 dark:text-purple-400">
							Генерация...
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{showControls && (
						<Button
							onClick={handleGenerate}
							disabled={isGenerating || filesPending === 0}
							className="h-7 gap-1.5"
							size="sm"
							variant="outline"
						>
							{isGenerating ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<Brain className="size-3" />
							)}
							{isGenerating ? "Генерация..." : "Создать"}
						</Button>
					)}
					<Button
						onClick={handleRefresh}
						disabled={loading}
						className="h-7 gap-1.5"
						size="sm"
						variant="ghost"
					>
						<RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
					</Button>
				</div>
			</div>

			{/* Stats */}
			{stats && (
				<div className="space-y-2">
					{/* Books stats */}
					<div className="rounded-md border bg-muted/30 p-2">
						<div className="mb-1 text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
							Книги
						</div>
						<div className="flex items-center justify-between text-sm">
							<span>
								С эмбеддингами:{" "}
								<span className="font-semibold">{stats.books.embedded}</span>
							</span>
							<span className="text-muted-foreground text-xs">
								из {stats.books.total}
							</span>
						</div>
						{stats.books.pending > 0 && (
							<div className="mt-1 text-muted-foreground text-xs">
								Ожидают: {stats.books.pending}
							</div>
						)}
					</div>

					{/* Files stats */}
					<div className="rounded-md border bg-muted/30 p-2">
						<div className="mb-1 text-muted-foreground text-[10px] uppercase tracking-[0.12em]">
							Файлы
						</div>
						<div className="flex items-center justify-between text-sm">
							<span>
								С эмбеддингами:{" "}
								<span className="font-semibold">{filesEmbedded}</span>
							</span>
							<span className="text-muted-foreground text-xs">
								из {filesTotal}
							</span>
						</div>
						{filesPending > 0 && (
							<div className="mt-1 text-muted-foreground text-xs">
								Ожидают: {filesPending}
							</div>
						)}
					</div>

					{/* Progress bar for files */}
					{(isGenerating || isBackgroundGenerating) && (
						<div className="space-y-1">
							<div className="flex items-center justify-between text-xs">
								<span>Прогресс</span>
								<span className="font-medium">{percentage}%</span>
							</div>
							<Progress value={percentage} className="h-1.5" />
							<p className="text-muted-foreground text-xs">
								Сгенерировано {filesEmbedded}/{filesTotal} эмбеддингов
							</p>
						</div>
					)}

					{/* Completed state */}
					{!isGenerating &&
						!isBackgroundGenerating &&
						filesPending === 0 &&
						filesTotal > 0 && (
							<div className="rounded-md bg-emerald-500/10 p-2 text-emerald-700 text-xs dark:text-emerald-400">
								Все эмбеддинги сгенерированы ({filesTotal}/{filesTotal})
							</div>
						)}

					{/* No embeddings yet */}
					{filesTotal === 0 && (
						<div className="text-muted-foreground text-xs">
							Нет файлов для генерации эмбеддингов
						</div>
					)}
				</div>
			)}

			{/* Error */}
			{(error || generationError) && (
				<div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
					{error || generationError}
				</div>
			)}
		</div>
	);
}
