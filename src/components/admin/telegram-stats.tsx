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

	// Функция для анимации цифр
	const animateNumbers = useCallback(
		(from: TelegramStats, to: TelegramStats) => {
			const duration = 1000; // 1 секунда
			const steps = 60; // 60 кадров в секунду
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

			// Получаем сессию для авторизации
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

			// Анимируем изменение цифр только если это не первая загрузка
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

			// Не отправляем сообщение об обновлении статистики в окно результатов при каждой загрузке
			// Это будет сделано только один раз в конце операции обновления

			// Возвращаем новые статистические данные
			return newStats;
		} catch (err: unknown) {
			console.error("Error loading Telegram stats:", err);
			setError(
				`Ошибка загрузки статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}`,
			);

			// Отправляем сообщение об ошибке в окно результатов только при ошибке
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${timestamp}] ❌ Ошибка загрузки статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}\n`;

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(errorReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			// В случае ошибки возвращаем текущие данные
			return statsRef.current;
		}
	}, [animateNumbers]);

	// Загружаем начальные данные и делаем функцию доступной глобально
	useEffect(() => {
		// Добавим небольшую задержку чтобы убедиться что все готово
		const timer = setTimeout(() => {
			loadStats();
		}, 100);

		// @ts-expect-error
		window.refreshSyncStats = loadStats;

		// Очищаем при размонтировании
		return () => {
			clearTimeout(timer);
			// Очищаем анимацию
			if (animationRef.current) {
				clearTimeout(animationRef.current);
			}

			// @ts-expect-error
			if (typeof window.refreshSyncStats === "function") {
				// @ts-expect-error
				delete window.refreshSyncStats;
			}
		};
	}, [loadStats]);

	const updateStats = async () => {
		try {
			setUpdating(true);
			setError(null);
			setSuccess(null);

			// Показываем начальный прогресс в результатах в формате приложения
			const timestamp = new Date().toLocaleTimeString("ru-RU");
			const progressReport = `[${timestamp}] 📊 Обновление статистики Telegram...\n`;

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(progressReport);
				} catch (error) {
					console.error(
						"❌ Ошибка при отправке сообщения в окно результатов:",
						error,
					);
				}
			}

			// Получаем сессию для авторизации
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

			// Обрабатываем как новый формат (синхронное обновление с прогрессом), так и старый формат (фоновое обновление)
			if (data.status === "error") {
				throw new Error(
					data.error || "Неизвестная ошибка при обновлении статистики",
				);
			}

			// Отправляем все прогресс-сообщения в окно результатов
			if (data.progress && Array.isArray(data.progress)) {
				// Новый формат - синхронное обновление с прогрессом
				data.progress.forEach(
					(progressItem: { progress: number; message: string }) => {
						const progressTimestamp = new Date().toLocaleTimeString("ru-RU");
						const progressLog = `[${progressTimestamp}] 📈 ${progressItem.message}\n`;

						// Используем правильную функцию для передачи логов в админ-панель
						if (
							typeof window !== "undefined" &&
							(window as any).setStatsUpdateReport
						) {
							try {
								(window as any).setStatsUpdateReport(progressLog);
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
				// Старый формат - фоновое обновление
				const progressTimestamp = new Date().toLocaleTimeString("ru-RU");
				const progressLog = `[${progressTimestamp}] 📊 ${data.message}\n`;

				// Используем правильную функцию для передачи логов в админ-панель
				if (
					typeof window !== "undefined" &&
					(window as any).setStatsUpdateReport
				) {
					try {
						(window as any).setStatsUpdateReport(progressLog);
					} catch (error) {
						console.error(
							"❌ Error sending progress message to results window:",
							error,
						);
					}
				}
			}

			// Загружаем обновленные статистические данные
			// Загружаем обновленные статистические данные
			await loadStats();

			setUpdating(false); // Разблокируем кнопку после завершения

			// Показываем итоговое сообщение
			const finalTimestamp = new Date().toLocaleTimeString("ru-RU");
			let finalReport = `[${finalTimestamp}] ✅ Обновление статистики завершено!\n`;

			if (data.stats) {
				finalReport += `\n📊 === ИТОГОВАЯ СТАТИСТИКА ===\n`;
				finalReport += `📚 Книг в базе данных: ${data.stats.booksInDatabase}\n`;
				finalReport += `📡 Книг в Telegram: ${data.stats.booksInTelegram}\n`;
				finalReport += `❌ Отсутствующих книг: ${data.stats.missingBooks}\n`;
				finalReport += `📁 Книг без файлов: ${data.stats.booksWithoutFiles}\n`;
			}

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(finalReport);
				} catch (error) {
					console.error(
						"❌ Error sending final message to results window:",
						error,
					);
				}
			}
		} catch (err: unknown) {
			console.error("Error updating stats:", err);
			// ВАЖНО: Гарантируем разблокировку кнопки при любой ошибке
			setUpdating(false);

			// Обновляем данные в карточках даже при ошибке, чтобы показать актуальную информацию
			await loadStats();

			setError(
				`Ошибка при обновлении статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}`,
			);

			// Показываем ошибку в результатах
			const errorTimestamp = new Date().toLocaleTimeString("ru-RU");
			const errorReport = `[${errorTimestamp}] ❌ Ошибка обновления статистики Telegram: ${(err as Error).message || "Неизвестная ошибка"}\n`;

			// Используем правильную функцию для передачи логов в админ-панель
			if (
				typeof window !== "undefined" &&
				(window as any).setStatsUpdateReport
			) {
				try {
					(window as any).setStatsUpdateReport(errorReport);
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
		<Card className="relative">
			<CardHeader className="space-y-0 pb-1">
				<CardTitle className="text-lg font-semibold">Статистика</CardTitle>
			</CardHeader>
			<div className="absolute top-2 right-3">
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
			<CardContent className="pb-2">
				{/* Локальные сообщения убраны - вся информация в результатах операции */}

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
					<div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
						<div className="flex items-center">
							<BookOpen className="h-5 w-5 text-blue-500 mr-2" />
							<h3 className="font-medium">Книг в Telegram</h3>
						</div>
						<p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
							{animatedStats.booksInTelegram.toLocaleString()}
						</p>
					</div>

					<div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
						<div className="flex items-center">
							<Database className="h-5 w-5 text-green-500 mr-2" />
							<h3 className="font-medium">Книг в базе данных</h3>
						</div>
						<p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
							{animatedStats.booksInDatabase.toLocaleString()}
						</p>
					</div>

					<div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
						<div className="flex items-center">
							<AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
							<h3 className="font-medium">Отсутствует</h3>
						</div>
						<p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
							{animatedStats.missingBooks.toLocaleString()}
						</p>
					</div>

					<div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
						<div className="flex items-center">
							<File className="h-5 w-5 text-red-500 mr-2" />
							<h3 className="font-medium">Книг без файлов</h3>
						</div>
						<p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
							{animatedStats.booksWithoutFiles.toLocaleString()}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
