"use client";

import {
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrowserSupabase } from "@/lib/browserSupabase";

interface SyncJobResult {
	id: string;
	job_type: "full" | "update" | "auto";
	status: "running" | "completed" | "failed";
	started_at: string;
	completed_at?: string;
	metadata_processed?: number;
	metadata_added?: number;
	metadata_updated?: number;
	metadata_skipped?: number;
	metadata_errors?: number;
	files_processed?: number;
	files_linked?: number;
	files_skipped?: number;
	files_errors?: number;
	error_message?: string;
	log_output?: string;
}

interface SyncResultsPanelProps {
	refreshTrigger?: number;
}

export function SyncResultsPanel({ refreshTrigger }: SyncResultsPanelProps) {
	const [results, setResults] = useState<SyncJobResult[]>([]);
	const [loading, setLoading] = useState(true);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const supabase = getBrowserSupabase();

	const fetchResults = useCallback(async () => {
		try {
			setLoading(true);
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return;

			const response = await fetch("/api/admin/sync-results?limit=10", {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setResults(data.results || []);
			}
		} catch (error) {
			console.error("Error fetching sync results:", error);
		} finally {
			setLoading(false);
		}
	}, [supabase]);

	useEffect(() => {
		fetchResults();
	}, [fetchResults, refreshTrigger]);

	// Автообновление каждые 30 секунд если есть running задачи
	useEffect(() => {
		const hasRunning = results.some((r) => r.status === "running");
		if (!hasRunning) return;

		const interval = setInterval(fetchResults, 30000);
		return () => clearInterval(interval);
	}, [results, fetchResults]);

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleString("ru-RU", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDuration = (start: string, end?: string) => {
		if (!end) return "...";
		const durationMs = new Date(end).getTime() - new Date(start).getTime();
		const seconds = Math.floor(durationMs / 1000);
		if (seconds < 60) return `${seconds} сек`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes} мин ${remainingSeconds} сек`;
	};

	const getJobTypeLabel = (type: string) => {
		switch (type) {
			case "full":
				return "Полная";
			case "update":
				return "Обновление";
			case "auto":
				return "Авто";
			default:
				return type;
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "failed":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "running":
				return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
			default:
				return <Clock className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const getStatusBadgeClass = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-500/10 text-green-600 dark:text-green-400";
			case "failed":
				return "bg-red-500/10 text-red-600 dark:text-red-400";
			case "running":
				return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
			default:
				return "bg-muted text-muted-foreground";
		}
	};

	const toggleExpand = (id: string) => {
		setExpandedId(expandedId === id ? null : id);
	};

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold flex items-center gap-2">
						<Clock className="h-4 w-4" />
						История операций
					</CardTitle>
					<Button
						variant="ghost"
						size="sm"
						onClick={fetchResults}
						disabled={loading}
					>
						<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px] pr-4">
					{loading && results.length === 0 ? (
						<div className="flex items-center justify-center py-8 text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin mr-2" />
							Загрузка...
						</div>
					) : results.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							История операций пуста
						</div>
					) : (
						<div className="space-y-3">
							{results.map((result) => (
								<div
									key={result.id}
									className="border rounded-lg overflow-hidden"
								>
									{/* Заголовок задачи */}
									<button
										type="button"
										className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
										onClick={() => toggleExpand(result.id)}
									>
										<div className="flex items-center gap-3">
											{getStatusIcon(result.status)}
											<div>
												<div className="flex items-center gap-2">
													<span className="font-medium">
														{getJobTypeLabel(result.job_type)}
													</span>
													<span
														className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeClass(result.status)}`}
													>
														{result.status === "completed"
															? "Завершено"
															: result.status === "failed"
																? "Ошибка"
																: "Выполняется"}
													</span>
												</div>
												<div className="text-sm text-muted-foreground">
													{formatDate(result.started_at)}
													{result.completed_at && (
														<span className="ml-2">
															(
															{formatDuration(
																result.started_at,
																result.completed_at,
															)}
															)
														</span>
													)}
												</div>
											</div>
										</div>
										{expandedId === result.id ? (
											<ChevronUp className="h-4 w-4 text-muted-foreground" />
										) : (
											<ChevronDown className="h-4 w-4 text-muted-foreground" />
										)}
									</button>

									{/* Развернутые детали */}
									{expandedId === result.id && (
										<div className="px-4 pb-4 pt-2 border-t bg-muted/30">
											{/* Статистика */}
											<div className="grid grid-cols-2 gap-2 mb-3">
												{result.metadata_processed !== undefined && (
													<div className="text-sm">
														<span className="text-muted-foreground">
															Обработано:
														</span>{" "}
														{result.metadata_processed}
													</div>
												)}
												{result.metadata_added !== undefined &&
													result.metadata_added > 0 && (
														<div className="text-sm">
															<span className="text-muted-foreground">
																Добавлено:
															</span>{" "}
															<span className="text-green-600 dark:text-green-400">
																+{result.metadata_added}
															</span>
														</div>
													)}
												{result.metadata_updated !== undefined &&
													result.metadata_updated > 0 && (
														<div className="text-sm">
															<span className="text-muted-foreground">
																Обновлено:
															</span>{" "}
															{result.metadata_updated}
														</div>
													)}
												{result.files_linked !== undefined &&
													result.files_linked > 0 && (
														<div className="text-sm">
															<span className="text-muted-foreground">
																Файлов привязано:
															</span>{" "}
															{result.files_linked}
														</div>
													)}
											</div>

											{/* Ошибка */}
											{result.error_message && (
												<div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded mb-3">
													{result.error_message}
												</div>
											)}

											{/* Лог */}
											{result.log_output && (
												<details className="text-sm">
													<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
														Показать лог
													</summary>
													<div className="mt-2 p-2 bg-muted rounded text-sm overflow-x-auto whitespace-pre-wrap">
														{result.log_output}
													</div>
												</details>
											)}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
