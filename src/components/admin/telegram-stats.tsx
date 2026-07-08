"use client";

import { AlertCircle, BookOpen, Database, File } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getBrowserSupabase } from "@/lib/browserSupabase";

interface TelegramStats {
	booksInDatabase: number;
	booksInTelegram: number;
	missingBooks: number;
	booksWithoutFiles: number;
}

interface PreviousStats {
	booksInDatabase: number;
	booksInTelegram: number;
	missingBooks: number;
	booksWithoutFiles: number;
}

declare global {
	interface Window {
		refreshSyncStats?: () => Promise<TelegramStats>;
		setStatsUpdateReport?: (report: string) => void;
	}
}

export function TelegramStatsSection() {
	const [stats, setStats] = useState<TelegramStats>({
		booksInDatabase: 0,
		booksInTelegram: 0,
		missingBooks: 0,
		booksWithoutFiles: 0,
	});
	const [_previousStats, setPreviousStats] = useState<PreviousStats>({
		booksInDatabase: 0,
		booksInTelegram: 0,
		missingBooks: 0,
		booksWithoutFiles: 0,
	});
	const [updating, setUpdating] = useState(false);
	const [_error, setError] = useState<string | null>(null);
	const [_success, setSuccess] = useState<string | null>(null);
	const [animatedStats, setAnimatedStats] = useState<TelegramStats>({
		booksInDatabase: 0,
		booksInTelegram: 0,
		missingBooks: 0,
		booksWithoutFiles: 0,
	});
	const animationRef = useRef<NodeJS.Timeout | null>(null);
	const statsRef = useRef(stats);

	useEffect(() => {
		statsRef.current = stats;
	}, [stats]);

	const animateNumbers = useCallback(
		(from: TelegramStats, to: TelegramStats) => {
			const duration = 1000;
			const steps = 60;
			const stepDuration = duration / steps;
			const stepValue = {
				booksInDatabase: (to.booksInDatabase - from.booksInDatabase) / steps,
				booksInTelegram: (to.booksInTelegram - from.booksInTelegram) / steps,
				missingBooks: (to.missingBooks - from.missingBooks) / steps,
				booksWithoutFiles:
					(to.booksWithoutFiles - from.booksWithoutFiles) / steps,
			};

			let currentStep = 0;

			const animate = () => {
				currentStep++;
				setAnimatedStats({
					booksInDatabase: Math.round(
						from.booksInDatabase + stepValue.booksInDatabase * currentStep,
					),
					booksInTelegram: Math.round(
						from.booksInTelegram + stepValue.booksInTelegram * currentStep,
					),
					missingBooks: Math.round(
						from.missingBooks + stepValue.missingBooks * currentStep,
					),
					booksWithoutFiles: Math.round(
						from.booksWithoutFiles + stepValue.booksWithoutFiles * currentStep,
					),
				});

				if (currentStep < steps) {
					animationRef.current = setTimeout(animate, stepDuration);
				} else {
					setAnimatedStats(to);
				}
			};

			animate();
		},
		[],
	);

	const loadStats = useCallback(async () => {
		try {
			setError(null);

			const supabase = getBrowserSupabase();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			const response = await fetch("/api/admin/telegram-stats", {
				headers: {
					Authorization: `Bearer ${session?.access_token}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("API error response:", errorData);
				throw new Error(
					errorData.error || `HTTP error! status: ${response.status}`,
				);
			}

			const data = await response.json();

			const newStats = {
				booksInDatabase: data.booksInDatabase || 0,
				booksInTelegram: data.booksInTelegram || 0,
				missingBooks: data.missingBooks || 0,
				booksWithoutFiles: data.booksWithoutFiles || 0,
			};

			const currentStats = statsRef.current;
			if (
				currentStats.booksInDatabase !== 0 ||
				currentStats.booksInTelegram !== 0
			) {
				setPreviousStats(currentStats);
				animateNumbers(currentStats, newStats);
			} else {
				setAnimatedStats(newStats);
			}

			setStats(newStats);

			return newStats;
		} catch (err: unknown) {
			console.error("Error loading Telegram stats:", err);
			setError(
				`Ошибка загрузки статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}`,
			);

			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${timestamp}] ❌ Ошибка загрузки статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}\n`;

			if (typeof window !== "undefined" && window.setStatsUpdateReport) {
				try {
					window.setStatsUpdateReport(errorReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			return statsRef.current;
		}
	}, [animateNumbers]);

	useEffect(() => {
		const timer = setTimeout(() => {
			loadStats();
		}, 100);

		window.refreshSyncStats = loadStats;

		return () => {
			clearTimeout(timer);
			if (animationRef.current) {
				clearTimeout(animationRef.current);
			}

			if (typeof window.refreshSyncStats === "function") {
				delete window.refreshSyncStats;
			}
		};
	}, [loadStats]);

	const updateStats = async () => {
		try {
			setUpdating(true);
			setError(null);
			setSuccess(null);

			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const progressReport = `[${timestamp}] 📊 Обновление статистики Telegram...\n`;

			if (typeof window !== "undefined" && window.setStatsUpdateReport) {
				try {
					window.setStatsUpdateReport(progressReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			const supabase = getBrowserSupabase();
			const {
				data: { session },
			} = await supabase.auth.getSession();

			const response = await fetch("/api/admin/telegram-stats?sync=true", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${session?.access_token}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("Update API error response:", errorData);
				throw new Error(
					errorData.error || `HTTP error! status: ${response.status}`,
				);
			}

			const data = await response.json();

			if (data.status === "error") {
				throw new Error(
					data.error || "Неизвестная ошибка при обновлении статистики",
				);
			}

			if (data.progress && Array.isArray(data.progress)) {
				data.progress.forEach(
					(progressItem: { progress: number; message: string }) => {
						const progressTimestamp = new Date().toLocaleTimeString("ru-RU");
						const progressLog = `[${progressTimestamp}] 📈 ${progressItem.message}\n`;

						if (typeof window !== "undefined" && window.setStatsUpdateReport) {
							try {
								window.setStatsUpdateReport(progressLog);
							} catch (error) {
								console.error(
									"❌ Error sending progress message to results window:",
									error,
								);
							}
						}
					},
				);
			} else if (data.status === "processing") {
				const progressTimestamp = new Date().toLocaleTimeString("ru-RU");
				const progressLog = `[${progressTimestamp}] 📊 ${data.message}\n`;

				if (typeof window !== "undefined" && window.setStatsUpdateReport) {
					try {
						window.setStatsUpdateReport(progressLog);
					} catch (error) {
						console.error(
							"❌ Error sending progress message to results window:",
							error,
						);
					}
				}
			}

			await loadStats();

			setUpdating(false);

			const finalTimestamp = new Date().toLocaleTimeString("ru-RU");
			let finalReport = `[${finalTimestamp}] ✅ Обновление статистики завершено!\n`;

			if (data.stats) {
				finalReport += `\n📊 === ИТОГОВАЯ СТАТИСТИКА ===\n`;
				finalReport += `📚 Книг в базе данных: ${data.stats.booksInDatabase}\n`;
				finalReport += `📡 Книг в Telegram: ${data.stats.booksInTelegram}\n`;
				finalReport += `❌ Отсутствующих книг: ${data.stats.missingBooks}\n`;
				finalReport += `📁 Книг без файлов: ${data.stats.booksWithoutFiles}\n`;
			}

			if (typeof window !== "undefined" && window.setStatsUpdateReport) {
				try {
					window.setStatsUpdateReport(finalReport);
				} catch (error) {
					console.error(
						"❌ Error sending final message to results window:",
						error,
					);
				}
			}
		} catch (err: unknown) {
			console.error("Error updating stats:", err);
			setUpdating(false);

			await loadStats();

			setError(
				`Ошибка при обновлении статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}`,
			);

			const errorTimestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${errorTimestamp}] ❌ Ошибка обновления статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}\n`;

			if (typeof window !== "undefined" && window.setStatsUpdateReport) {
				try {
					window.setStatsUpdateReport(errorReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}
		}
	};

	return (
		<Card className="relative min-h-[252px] rounded-lg shadow-sm xl:col-span-2">
			<CardHeader className="space-y-0 pb-2">
				<CardTitle>Статистика</CardTitle>
			</CardHeader>
			<div className="absolute top-3 right-3 sm:top-4 sm:right-4">
				<Button
					onClick={updateStats}
					disabled={updating}
					variant="outline"
					size="sm"
					className="min-w-[100px] h-8 text-sm"
				>
					{updating ? (
						<>
							<Spinner className="h-4 w-4 mr-2" />
							Обновление...
						</>
					) : (
						<>Обновить</>
					)}
				</Button>
			</div>
			<CardContent className="pt-2">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
					<div className="relative flex min-h-[132px] flex-col items-center justify-between rounded-md border bg-card p-4 text-center transition-colors hover:bg-muted/40">
						<BookOpen className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
						<h3 className="max-w-[calc(100%-56px)] pt-1 font-medium text-sm leading-tight">
							Книг в Telegram
						</h3>
						<p className="pb-1 text-center font-bold text-3xl tabular-nums transition-all duration-300">
							{animatedStats.booksInTelegram.toLocaleString()}
						</p>
					</div>

					<div className="relative flex min-h-[132px] flex-col items-center justify-between rounded-md border bg-card p-4 text-center transition-colors hover:bg-muted/40">
						<Database className="absolute left-4 top-4 h-5 w-5 text-green-500" />
						<h3 className="max-w-[calc(100%-56px)] pt-1 font-medium text-sm leading-tight">
							Книг в базе данных
						</h3>
						<p className="pb-1 text-center font-bold text-3xl tabular-nums transition-all duration-300">
							{animatedStats.booksInDatabase.toLocaleString()}
						</p>
					</div>

					<div className="relative flex min-h-[132px] flex-col items-center justify-between rounded-md border bg-card p-4 text-center transition-colors hover:bg-muted/40">
						<AlertCircle className="absolute left-4 top-4 h-5 w-5 text-yellow-500" />
						<h3 className="max-w-[calc(100%-56px)] pt-1 font-medium text-sm leading-tight">
							Отсутствует
						</h3>
						<p className="pb-1 text-center font-bold text-3xl tabular-nums transition-all duration-300">
							{animatedStats.missingBooks.toLocaleString()}
						</p>
					</div>

					<div className="relative flex min-h-[132px] flex-col items-center justify-between rounded-md border bg-card p-4 text-center transition-colors hover:bg-muted/40">
						<File className="absolute left-4 top-4 h-5 w-5 text-red-500" />
						<h3 className="max-w-[calc(100%-56px)] pt-1 font-medium text-sm leading-tight">
							Книг без файлов
						</h3>
						<p className="pb-1 text-center font-bold text-3xl tabular-nums transition-all duration-300">
							{animatedStats.booksWithoutFiles.toLocaleString()}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
