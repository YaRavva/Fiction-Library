"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { type FileOption, FileSelector } from "./file-selector";

interface BookWithoutFile {
	id: string;
	title: string;
	author: string;
	publication_year?: number;
}

interface ProcessingState {
	status:
		| "idle"
		| "loading"
		| "searching"
		| "processing"
		| "completed"
		| "error";
	message: string;
}

export function FileSearchManager() {
	const [processingState, setProcessingState] = useState<ProcessingState>({
		status: "idle",
		message: "",
	});
	const [_error, setError] = useState<string | null>(null);
	const [isResetting, setIsResetting] = useState(false); // Флаг для отслеживания сброса

	const [booksWithoutFiles, setBooksWithoutFiles] = useState<BookWithoutFile[]>(
		[],
	);
	const [currentBookIndex, setCurrentBookIndex] = useState(0);
	const [_selectedFileIndex, setSelectedFileIndex] = useState(0);
	const [showFileSelector, setShowFileSelector] = useState(false);
	const [fileSelectorKey, setFileSelectorKey] = useState(0); // Состояние-флаг для перерендеринга FileSelector

	// Используем useRef для хранения файлов вместо состояния
	const allTelegramFilesRef = useRef<FileOption[]>([]);
	const currentBookFilesRef = useRef<FileOption[]>([]);

	// Добавляем ref для хранения информации о текущей книге на момент открытия селектора
	const currentBookRef = useRef<BookWithoutFile | null>(null);

	// Функция для логирования в окно результатов
	const logToResults = (message: string) => {
		const timestamp = new Date().toLocaleTimeString("ru-RU");
		const logMessage = `[${timestamp}] ${message}\n`;

		// Выводим в консоль для отладки
		console.log("FileSearchManager log:", message);

		// Проверяем, доступна ли родительская функция обновления результатов
		if (
			typeof window !== "undefined" &&
			(window as any).updateFileSearchResults
		) {
			try {
				(window as any).updateFileSearchResults(logMessage);
				console.log("✅ Message sent to results window:", message);
			} catch (error) {
				console.error(
					"❌ Ошибка при отправке сообщения в окно результатов:",
					error,
				);
				console.error(
					"Available window properties:",
					Object.keys(window || {}),
				);
			}
		} else {
			console.log("❌ updateFileSearchResults not available");
			console.log("Available window properties:", Object.keys(window || {}));
		}
	};

	// Добавляем функцию для прямого логирования в консоль браузера
	const _logToConsole = (message: string) => {
		console.log(`🔍 FileSearch: ${message}`);
	};

	// Получение токена авторизации
	const getAuthToken = async (): Promise<string> => {
		const supabase = getBrowserSupabase();
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();

		if (error) {
			throw new Error(`Ошибка получения сессии: ${error.message}`);
		}

		if (!session || !session.access_token) {
			throw new Error("Токен авторизации не найден");
		}

		return session.access_token;
	};

	// Очистка привязки файла к книге
	const _clearFileLink = async (bookId: string): Promise<void> => {
		const token = await getAuthToken();

		const response = await fetch("/api/admin/clear-file-link", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				bookId,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage =
				errorData.error ||
				`HTTP ошибка: ${response.status} ${response.statusText}`;
			throw new Error(errorMessage);
		}

		const result = await response.json();
		logToResults(`✅ ${result.message}`);
	};

	// Загрузка книг без файлов (обработка всех книг без файлов)
	const loadBooksWithoutFiles = async (): Promise<BookWithoutFile[]> => {
		logToResults("📚 Поиск всех книг без файлов...");

		const supabase = getBrowserSupabase();

		try {
			// Получаем все книги без файлов
			const { data, error: dbError } = await supabase
				.from("books")
				.select("id, title, author, publication_year")
				.is("file_url", null)
				.order("author", { ascending: true })
				.order("title", { ascending: true });

			if (dbError) {
				logToResults(`❌ Ошибка при запросе книг: ${dbError.message}`);
				throw new Error(`Ошибка базы данных: ${dbError.message}`);
			}

			logToResults(`📊 Найдено ${data?.length || 0} книг без файлов`);

			if (data && data.length > 0) {
				return data;
			} else {
				logToResults("❌ В базе данных нет книг без файлов.");
				return []; // Возвращаем пустой массив
			}
		} catch (err: any) {
			// Более детальнаяльная обработка ошибок
			console.error("Ошибка при загрузке книг без файлов:", err);

			// Попытка получить больше информации об ошибке
			let errorMessage = "Неизвестная ошибка при поиске книг";
			if (err && typeof err === "object") {
				if (err.message) {
					errorMessage = err.message;
				} else if (Object.keys(err).length > 0) {
					errorMessage = JSON.stringify(err);
				}
			} else if (typeof err === "string") {
				errorMessage = err;
			}

			logToResults(`❌ ${errorMessage}`);
			throw new Error(errorMessage);
		}
	};

	// Серверный поиск файлов с использованием UniversalFileMatcher на сервере
	const performServerSearch = async (
		book: BookWithoutFile,
	): Promise<FileOption[]> => {
		const token = await getAuthToken();
		logToResults(`🔍 Серверный поиск: "${book.author}" - "${book.title}"...`);

		try {
			const params = new URLSearchParams({
				author: book.author,
				title: book.title,
				limit: "15",
			});

			const response = await fetch(
				`/api/admin/file-search/query?${params.toString()}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			if (!response.ok) {
				throw new Error(`Ошибка поиска: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.message) {
				logToResults(`⚠️ ${data.message}`);
			}

			logToResults(`✅ Найдено релевантных файлов: ${data.files?.length || 0}`);
			return data.files || [];
		} catch (error) {
			console.error("Server search error:", error);
			logToResults(
				`❌ Ошибка поиска: ${error instanceof Error ? error.message : String(error)}`,
			);
			return [];
		}
	};

	// Загрузка всех файлов из Telegram канала (DEPRECATED - теперь используем серверный поиск)
	// Оставляем пустышку для совместимости с типами, если нужно, или удаляем
	const _loadTelegramFiles = async (): Promise<FileOption[]> => {
		logToResults(
			"⚠️ Загрузка всех файлов отключена в пользу серверного поиска.",
		);
		return [];
	};

	// Поиск подходящих файлов для книги (Клиентская версия - более не используется активно, но может пригодиться как fallback)
	const _findMatchingFilesClient = (
		book: BookWithoutFile,
		files: FileOption[],
	): FileOption[] => {
		// ... старая логика ...
		return files; // Заглушка
	};

	// Показать файлы для текущей книги
	const showFilesForCurrentBook = useCallback(
		async (books: BookWithoutFile[], _files: FileOption[] = []) => {
			if (books.length === 0) {
				logToResults("❌ Нет книг для обработки.");
				setProcessingState({
					status: "idle",
					message: "Нет книг для обработки.",
				});
				return;
			}

			if (currentBookIndex < 0 || currentBookIndex >= books.length) {
				return;
			}

			const currentBook = books[currentBookIndex];
			if (!currentBook) return;

			// Сохраняем информацию о текущей книге в ref
			currentBookRef.current = currentBook;

			// АВТОМАТИЧЕСКИЙ ПОИСК (с использованием UniversalFileMatcher на сервере)
			logToResults(
				`🔍 Авто-поиск для: "${currentBook.title}" (${currentBook.author})`,
			);

			// Вызываем серверный поиск с полной информацией о книге
			const filesFound = await performServerSearch(currentBook);

			// Устанавливаем новые файлы в ref
			currentBookFilesRef.current = filesFound;
			setSelectedFileIndex(0); // Выбираем первый файл по умолчанию

			// Увеличиваем ключ для полного перерендеринга FileSelector
			setFileSelectorKey((prev) => prev + 1);

			if (filesFound.length === 0) {
				logToResults("⚠️ Автоматический поиск не дал результатов.");
				// УБРАН АВТО-СКИП! Теперь пользователь сам должен пропустить или найти вручную.
			}

			// Всегда показываем селектор, чтобы дать возможность ручного поиска
			setShowFileSelector(true);

			setProcessingState({
				status: "searching",
				message: "Ожидание выбора пользователя...",
			});
		},
		[currentBookIndex, logToResults],
	);

	// Обработка следующей книги
	const processNextBook = useCallback(async () => {
		// Проверяем флаг сброса
		if (isResetting) {
			logToResults("⏹️ Процесс прерван пользователем (сброс).");
			setIsResetting(false);
			return;
		}

		const nextIndex = currentBookIndex + 1;
		if (nextIndex >= booksWithoutFiles.length) {
			logToResults("🎉 Обработка завершена! Книга успешно обработана.");
			setProcessingState({
				status: "completed",
				message: "Обработка завершена.",
			});
			setShowFileSelector(false); // Скрываем FileSelector при завершении
			setFileSelectorKey((prev) => prev + 1); // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
			return;
		}

		// Сначала скрываем FileSelector
		setShowFileSelector(false);
		// Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
		setFileSelectorKey((prev) => prev + 1);

		// Обновляем индекс книги и информацию о текущей книге в ref
		setCurrentBookIndex(nextIndex);
		setSelectedFileIndex(0); // Сброс выбранного файла для новой книги

		// Обновляем информацию о текущей книге в ref сразу после изменения индекса
		if (nextIndex < booksWithoutFiles.length) {
			currentBookRef.current = booksWithoutFiles[nextIndex];
			// Убираем дублирующее сообщение, оставляем только при актуализации
		}

		// Ждем следующего рендера и показываем файлы для следующей книги
		setTimeout(() => {
			showFilesForCurrentBook(booksWithoutFiles, allTelegramFilesRef.current);
		}, 0);
	}, [
		booksWithoutFiles,
		currentBookIndex,
		showFilesForCurrentBook,
		logToResults,
		isResetting,
	]);

	// Обработка выбора файла
	const handleFileSelect = useCallback(
		async (fileToSelect: FileOption | null) => {
			// Проверяем флаг сброса
			if (isResetting) {
				logToResults("⏹️ Процесс прерван пользователем (сброс).");
				setIsResetting(false);
				setShowFileSelector(false);
				setFileSelectorKey((prev) => prev + 1);
				return;
			}

			// Скрываем FileSelector
			setShowFileSelector(false);
			// Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
			setFileSelectorKey((prev) => prev + 1);

			logToResults(
				`🎯 Выбор файла: ${fileToSelect ? fileToSelect.file_name : "ПРОПУСК"}`,
			);

			if (!fileToSelect) {
				logToResults("⏭️ Файл не выбран, переходим к следующей книге.");
				await processNextBook();
				return;
			}

			// Получаем информацию о текущей книге из ref или состояния
			let currentBook = currentBookRef.current;
			if (
				!currentBook ||
				currentBook.id !== booksWithoutFiles[currentBookIndex]?.id
			) {
				// Если ref пуст или не соответствует текущей книге, используем книгу из состояния
				if (currentBookIndex < booksWithoutFiles.length) {
					currentBook = booksWithoutFiles[currentBookIndex];
					// Обновляем ref для будущих обращений
					currentBookRef.current = currentBook;
					logToResults(
						`📚 Актуализируем информацию о текущей книге: ${currentBook.author} - ${currentBook.title}`,
					);
				} else {
					logToResults(`❌ Ошибка: текущая книга не найдена при выборе файла.`);
					setProcessingState({
						status: "error",
						message: "Ошибка: текущая книга не найдена.",
					});
					return;
				}
			}

			logToResults(
				`📤 Загрузка файла "${fileToSelect.file_name}" для книги "${currentBook.title}"...`,
			);
			setProcessingState({
				status: "processing",
				message: "Загрузка и привязка файла...",
			});

			try {
				const token = await getAuthToken();

				const response = await fetch("/api/admin/file-link", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						bookId: currentBook.id,
						fileMessageId: fileToSelect.message_id,
					}),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					const errorMessage =
						errorData.error ||
						`HTTP ошибка: ${response.status} ${response.statusText}`;

					// Если файл уже существует, пробуем привязать существующий файл
					if (errorMessage.includes("The resource already exists")) {
						logToResults(
							`ℹ️ Файл уже существует в хранилище, пробуем привязать существующий файл к книге "${currentBook.author}: ${currentBook.title}"...`,
						);

						// Делаем запрос для привязки существующего файла
						const linkResponse = await fetch("/api/admin/file-link-existing", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${token}`,
							},
							body: JSON.stringify({
								bookId: currentBook.id,
								fileMessageId: fileToSelect.message_id,
							}),
						});

						if (!linkResponse.ok) {
							const linkErrorData = await linkResponse.json().catch(() => ({}));
							const linkErrorMessage =
								linkErrorData.error ||
								`HTTP ошибка: ${linkResponse.status} ${linkResponse.statusText}`;

							// Если файл не соответствует ожиданиям, загружаем новый
							if (
								linkErrorMessage === "FILE_MISMATCH_NEEDS_REUPLOAD" ||
								linkResponse.status === 422
							) {
								logToResults(
									`⚠️ Файл не соответствует ожиданиям, загружаем новый файл для книги "${currentBook.author}: ${currentBook.title}"...`,
								);

								// Повторно вызываем оригинальный endpoint для загрузки нового файла
								const retryResponse = await fetch("/api/admin/file-link", {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${token}`,
									},
									body: JSON.stringify({
										bookId: currentBook.id,
										fileMessageId: fileToSelect.message_id,
									}),
								});

								if (!retryResponse.ok) {
									const retryErrorData = await retryResponse
										.json()
										.catch(() => ({}));
									const retryErrorMessage =
										retryErrorData.error ||
										`HTTP ошибка: ${response.status} ${response.statusText}`;
									throw new Error(retryErrorMessage);
								}

								const _result = await retryResponse.json();
								logToResults(
									`✅ Новый файл успешно загружен и привязан к книге "${currentBook.author}: ${currentBook.title}"!`,
								);
							} else {
								throw new Error(linkErrorMessage);
							}
						} else {
							const _result = await linkResponse.json();
							logToResults(
								`✅ Существующий файл успешно привязан к книге "${currentBook.author}: ${currentBook.title}"!`,
							);
						}
					} else {
						logToResults(`❌ Ошибка при привязке файла: ${errorMessage}`);
						throw new Error(errorMessage);
					}
				} else {
					const _result = await response.json();
					logToResults(
						`✅ Файл успешно привязан к книге "${currentBook.author}: ${currentBook.title}"!`,
					);
				}

				// Переходим к следующей книге
				await processNextBook();
			} catch (err: any) {
				// Более детальная обработка ошибок
				console.error("Ошибка при привязке файла:", err);

				// Попытка получить больше информации об ошибке
				let errorMessage = "Неизвестная ошибка при привязке файла";
				if (err && typeof err === "object") {
					if (err.message) {
						errorMessage = err.message;
					} else if (Object.keys(err).length > 0) {
						errorMessage = JSON.stringify(err);
					}
				} else if (typeof err === "string") {
					errorMessage = err;
				}

				logToResults(`❌ Ошибка при привязке файла: ${errorMessage}`);
				setProcessingState({
					status: "error",
					message: `Ошибка: ${errorMessage}`,
				});
				// Переходим к следующей книге
				await processNextBook();
			}
		},
		[
			getAuthToken,
			processNextBook,
			isResetting,
			currentBookIndex,
			booksWithoutFiles,
			logToResults,
		],
	);

	// Пропуск книги
	const handleSkipBook = useCallback(async () => {
		// Проверяем флаг сброса
		if (isResetting) {
			logToResults("⏹️ Процесс прерван пользователем (сброс).");
			setIsResetting(false);
			setShowFileSelector(false);
			setFileSelectorKey((prev) => prev + 1);
			return;
		}

		// Скрываем FileSelector
		setShowFileSelector(false);
		// Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
		setFileSelectorKey((prev) => prev + 1);

		logToResults("⏭️ Пользователь выбрал пропустить книгу");

		// Получаем информацию о текущей книге из ref или состояния
		let currentBook = currentBookRef.current;
		if (
			!currentBook ||
			currentBook.id !== booksWithoutFiles[currentBookIndex]?.id
		) {
			// Если ref пуст или не соответствует текущей книге, используем книгу из состояния
			if (currentBookIndex < booksWithoutFiles.length) {
				currentBook = booksWithoutFiles[currentBookIndex];
				// Обновляем ref для будущих обращений
				currentBookRef.current = currentBook;
				logToResults(
					`📚 Актуализируем информацию о текущей книге: ${currentBook.author} - ${currentBook.title}`,
				);
			}
		}

		if (currentBook) {
			logToResults(`⏭️ Книга "${currentBook.title}" пропущена пользователем.`);
		} else {
			logToResults("⏭️ Книга пропущена (не найдена).");
		}

		// Переходим к следующей книге
		await processNextBook();
	}, [
		processNextBook,
		isResetting,
		currentBookIndex,
		booksWithoutFiles,
		logToResults,
	]);

	// Запуск интерактивного поиска
	const startInteractiveFileSearch = async () => {
		if (
			processingState.status !== "idle" &&
			processingState.status !== "completed" &&
			processingState.status !== "error"
		) {
			return;
		}

		logToResults("🚀 Запуск интерактивного поиска файлов...");
		setProcessingState({
			status: "loading",
			message: "Загрузка книг без файлов...",
		});
		setError(null);

		try {
			// Шаг 1: Получаем книги без файлов
			const books = await loadBooksWithoutFiles();
			setBooksWithoutFiles(books);

			if (books.length === 0) {
				setProcessingState({
					status: "idle",
					message: "Нет книг для обработки. Попробуйте обновить список книг.",
				});
				return;
			}

			// Шаг 2: Больше не загружаем все файлы. Сразу переходим к поиску для первой книги.

			// Шаг 3: Начинаем обработку первой книги
			setCurrentBookIndex(0);
			setSelectedFileIndex(0);

			// Очищаем ref с файлами
			allTelegramFilesRef.current = [];

			await showFilesForCurrentBook(books); // Без передачи файлов, запустит серверный поиск
		} catch (err: any) {
			// Более детальная обработка ошибок
			console.error("Ошибка интерактивного поиска:", err);

			// Попытка получить больше информации об ошибке
			let errorMessage = "Неизвестная ошибка";
			if (err && typeof err === "object") {
				if (err.message) {
					errorMessage = err.message;
				} else if (Object.keys(err).length > 0) {
					errorMessage = JSON.stringify(err);
				}
			} else if (typeof err === "string") {
				errorMessage = err;
			}

			setError(`Ошибка: ${errorMessage}`);
			setProcessingState({
				status: "error",
				message: `Ошибка: ${errorMessage}`,
			});
		}
	};

	// Сброс состояния
	const handleReset = useCallback(() => {
		logToResults("🔄 Сброс состояния поиска файлов...");
		setProcessingState({ status: "idle", message: "" });
		setError(null);
		setBooksWithoutFiles([]);
		setCurrentBookIndex(0);
		// Очищаем ref'ы вместо состояний
		currentBookFilesRef.current = [];
		allTelegramFilesRef.current = [];
		currentBookRef.current = null; // Очищаем ref с информацией о текущей книге
		setSelectedFileIndex(0);
		setShowFileSelector(false); // Скрываем FileSelector при сбросе
		setFileSelectorKey((prev) => prev + 1); // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
		setIsResetting(true); // Устанавливаем флаг сброса
		logToResults("✅ Состояние сброшено. Логи сохранены.");
	}, [logToResults]);

	return (
		<>
			<div className="flex items-center gap-4">
				<Button
					onClick={startInteractiveFileSearch}
					disabled={
						processingState.status === "loading" ||
						processingState.status === "searching" ||
						processingState.status === "processing"
					}
					size="default"
				>
					{processingState.status === "loading" ||
					processingState.status === "searching" ||
					processingState.status === "processing" ? (
						<>
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
							{processingState.status === "loading"
								? "Загрузка..."
								: "Поиск/Обработка..."}
						</>
					) : (
						<>Начать интерактивный поиск</>
					)}
				</Button>

				<Button variant="outline" onClick={handleReset} size="default">
					Сброс
				</Button>
			</div>

			{/* Отображаем FileSelector через портал */}
			{showFileSelector &&
				booksWithoutFiles.length > 0 &&
				currentBookIndex < booksWithoutFiles.length &&
				typeof document !== "undefined" &&
				createPortal(
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
						<div className="bg-card rounded-lg shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
							<FileSelector
								key={`file-selector-${fileSelectorKey}-${currentBookIndex}-${booksWithoutFiles[currentBookIndex].id}`}
								book={booksWithoutFiles[currentBookIndex]}
								files={
									currentBookFilesRef.current.length > 0
										? currentBookFilesRef.current
										: []
								}
								onSelect={handleFileSelect}
								onSkip={handleSkipBook}
							/>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
