"use client";

import {
	AlertCircle,
	Brain,
	CheckCircle2,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getBrowserSupabase } from "@/lib/browserSupabase";

const DEFAULT_MODEL = "voyage-ai/voyage-4";

interface EmbeddingModel {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

interface EmbeddingStats {
	books: {
		total: number;
		embedded: number;
		pending: number;
	};
	files: {
		total: number;
		embedded: number;
		pending: number;
	};
	schema?: {
		booksEmbeddingReady: boolean;
		filesEmbeddingReady: boolean;
		migrationRequired: boolean;
	};
}

type EmbedTarget = "books" | "files" | "all";
type BatchTarget = Exclude<EmbedTarget, "all">;

interface EmbedProgress {
	current: number;
	total: number;
	logs: string[];
}

export function EmbeddingPanel() {
	const [supabase] = useState(() => getBrowserSupabase());
	const [models, setModels] = useState<EmbeddingModel[]>([]);
	const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
	const [loadingTarget, setLoadingTarget] = useState<EmbedTarget | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [stats, setStats] = useState<EmbeddingStats | null>(null);
	const [progress, setProgress] = useState<EmbedProgress | null>(null);

	const getAuthHeaders = useCallback(async () => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) throw new Error("Unauthorized");
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.access_token}`,
		};
	}, [supabase.auth]);

	const fetchModels = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/embedding", {
				headers: await getAuthHeaders(),
			});
			const data = await response.json();

			if (data.error) {
				setError(data.error);
				return;
			}

			setModels(data.models || []);
			setSelectedModel(data.defaultModel || DEFAULT_MODEL);
		} catch (err: any) {
			setError(err.message || "Failed to fetch models");
		}
	}, [getAuthHeaders]);

	const fetchStats = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/embedding/stats", {
				headers: await getAuthHeaders(),
			});
			const data = await response.json();
			if (data.stats) {
				setStats(data.stats);
				return data.stats as EmbeddingStats;
			}
		} catch (err) {
			console.error("Failed to fetch stats:", err);
		}
		return null;
	}, [getAuthHeaders]);

	useEffect(() => {
		fetchModels();
		fetchStats();
	}, [fetchModels, fetchStats]);

	const appendProgress = (line: string, current: number, total: number) => {
		setProgress((previous) => ({
			current,
			total,
			logs: [...(previous?.logs || []), line].slice(-8),
		}));
	};

	const runBatch = async (target: BatchTarget) => {
		const response = await fetch("/api/admin/embedding", {
			method: "PUT",
			headers: await getAuthHeaders(),
			body: JSON.stringify({
				model: selectedModel || DEFAULT_MODEL,
				batchSize: 100,
				target,
			}),
		});
		const data = await response.json();

		if (data.error) {
			throw new Error(data.error);
		}

		if (data.migrationRequired) {
			throw new Error(data.message);
		}

		return data as {
			message: string;
			books: { embedded: number; total: number };
			files: { embedded: number; total: number };
		};
	};

	const handleEmbed = async (target: EmbedTarget) => {
		setLoadingTarget(target);
		setError(null);
		setSuccess(null);
		setProgress({ current: 0, total: 0, logs: [] });

		try {
			const initialStats = (await fetchStats()) || stats;
			if (!initialStats) throw new Error("Failed to fetch stats");

			const targets: BatchTarget[] =
				target === "all" ? ["books", "files"] : [target];
			const total =
				target === "all"
					? initialStats.books.pending + initialStats.files.pending
					: initialStats[target].pending;
			let current = 0;
			appendProgress("0/".concat(String(total)), 0, total);

			for (const batchTarget of targets) {
				while (true) {
					const latestStats = (await fetchStats()) || initialStats;
					const pending = latestStats[batchTarget].pending;
					if (pending <= 0) break;

					const result = await runBatch(batchTarget);
					const embedded =
						batchTarget === "books"
							? result.books.embedded
							: result.files.embedded;
					current += embedded;

					const refreshedStats = await fetchStats();
					const actualCurrent = refreshedStats
						? total -
							(target === "all"
								? refreshedStats.books.pending + refreshedStats.files.pending
								: refreshedStats[batchTarget].pending)
						: current;

					appendProgress(
						`${batchTarget === "books" ? "Книги" : "Файлы"}: +${embedded} (${Math.min(actualCurrent, total)}/${total})`,
						Math.min(actualCurrent, total),
						total,
					);

					if (embedded === 0) break;
				}
			}

			setSuccess(`Готово: ${total}/${total}`);
			await fetchStats();
		} catch (err: any) {
			setError(err.message || "Failed to embed");
		} finally {
			setLoadingTarget(null);
		}
	};

	const statItems = stats
		? [
				["Книги", stats.books.embedded, stats.books.total],
				["Файлы", stats.files.embedded, stats.files.total],
			]
		: [];
	const filesEmbeddingReady = stats?.schema?.filesEmbeddingReady !== false;
	const progressValue =
		progress && progress.total > 0
			? Math.round((progress.current / progress.total) * 100)
			: 0;

	return (
		<Card>
			<CardContent className="space-y-3 p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Brain className="size-4 text-muted-foreground" />
						<h2 className="font-semibold text-sm">Embeddings</h2>
					</div>
					<Button
						size="icon"
						variant="outline"
						className="size-8"
						onClick={() => {
							fetchModels();
							fetchStats();
						}}
					>
						<RefreshCw className="size-3.5" />
					</Button>
				</div>

				<Select value={selectedModel} onValueChange={setSelectedModel}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{models.length === 0 ? (
							<SelectItem value={DEFAULT_MODEL}>{DEFAULT_MODEL}</SelectItem>
						) : (
							models.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.id}
								</SelectItem>
							))
						)}
					</SelectContent>
				</Select>

				{stats ? (
					<div className="grid grid-cols-2 gap-2">
						{statItems.map(([label, embedded, total]) => (
							<div key={label} className="rounded-md border bg-muted/40 p-2">
								<p className="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">
									{label}
								</p>
								<p className="mt-1 font-semibold text-sm">
									{embedded}/{total}
								</p>
							</div>
						))}
					</div>
				) : null}

				{stats?.schema?.migrationRequired ? (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
						Миграция pgvector не применена
					</p>
				) : null}

				{progress && loadingTarget ? (
					<div className="space-y-2 rounded-md border bg-muted/30 p-2">
						<div className="flex items-center justify-between text-xs">
							<span>
								{progress.current}/{progress.total}
							</span>
							<span>{progressValue}%</span>
						</div>
						<Progress value={progressValue} />
						<div className="space-y-1 text-muted-foreground text-xs">
							{progress.logs.map((line) => (
								<p key={line}>{line}</p>
							))}
						</div>
					</div>
				) : null}

				<div className="grid grid-cols-3 gap-2">
					{(["books", "files", "all"] as EmbedTarget[]).map((target) => (
						<Button
							key={target}
							size="sm"
							variant={target === "all" ? "default" : "outline"}
							onClick={() => handleEmbed(target)}
							disabled={
								loadingTarget !== null ||
								((target === "files" || target === "all") &&
									!filesEmbeddingReady)
							}
						>
							{loadingTarget === target ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : target === "books" ? (
								"Книги"
							) : target === "files" ? (
								"Файлы"
							) : (
								"Все"
							)}
						</Button>
					))}
				</div>

				{error ? (
					<div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-destructive text-xs">
						<AlertCircle className="size-3.5 shrink-0" />
						{error}
					</div>
				) : null}

				{success ? (
					<div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-2 text-emerald-700 text-xs dark:text-emerald-400">
						<CheckCircle2 className="size-3.5 shrink-0" />
						{success}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
