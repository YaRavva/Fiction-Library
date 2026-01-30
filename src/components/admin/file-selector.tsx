"use client";

import { Check, FileText, SkipForward, Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export interface FileOption {
	message_id: number;
	file_name?: string;
	file_size?: number;
	mime_type?: string;
	caption?: string;
	date: number;
	relevance_score?: number;
}

export interface BookInfo {
	id: string;
	title: string;
	author: string;
	publication_year?: number;
}

interface FileSelectorProps {
	book: BookInfo;
	files: FileOption[];
	onSelect: (file: FileOption | null) => void;
	onSkip: () => void;
	onSearch: (query: string) => Promise<FileOption[]>;
}

export function FileSelector({
	book,
	files,
	onSelect,
	onSkip,
	onSearch,
}: FileSelectorProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [displayedFiles, setDisplayedFiles] = useState<FileOption[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);

	// Инициализация строки поиска названием книги
	useEffect(() => {
		setSearchQuery(book.title);
	}, [book.title]);

	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim() || isSearching) return;

		setIsSearching(true);
		try {
			const results = await onSearch(searchQuery);
			setDisplayedFiles(results);
			setSelectedIndex(0);
		} catch (error) {
			console.error("Search failed:", error);
		} finally {
			setIsSearching(false);
		}
	}, [searchQuery, isSearching, onSearch]);

	const handleSelect = useCallback(() => {
		if (isProcessing || selectedIndex >= displayedFiles.length) return;

		setIsProcessing(true);
		onSelect(displayedFiles[selectedIndex]);
	}, [isProcessing, selectedIndex, displayedFiles, onSelect]);

	const handleSkip = useCallback(() => {
		if (isProcessing) return;
		onSkip();
	}, [isProcessing, onSkip]);

	// Обновляем отображаемые файлы при изменении входных файлов или книги
	useEffect(() => {
		// Увеличиваем количество отображаемых файлов до 15
		const limitedFiles = files.slice(0, 15);
		setDisplayedFiles(limitedFiles);
		setSelectedIndex(0); // Сбрасываем выбор при обновлении файлов
		setIsProcessing(false);
	}, [files]);

	// Обработчик клавиш
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Если фокус в инпуте, игнорируем стрелки и Enter (для выбора)
			// Но Enter для поиска обрабатывается в самом Input
			if (document.activeElement?.tagName === "INPUT") {
				if (event.key === "Escape") {
					// Escape должен работать везде (снять фокус или закрыть)
					(document.activeElement as HTMLElement).blur();
				}
				return;
			}

			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					setSelectedIndex((prev) => Math.max(0, prev - 1));
					break;

				case "ArrowDown":
					event.preventDefault();
					setSelectedIndex((prev) =>
						Math.min(displayedFiles.length - 1, prev + 1),
					);
					break;

				case "Enter":
					event.preventDefault();
					handleSelect();
					break;

				case "Escape":
					event.preventDefault();
					handleSkip();
					break;
			}
		},
		[displayedFiles.length, handleSelect, handleSkip],
	);

	// Навешиваем обработчик клавиш
	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	const formatFileSize = (bytes?: number) => {
		if (!bytes) return "Неизвестен";
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Если нет файлов, не отображаем компонент, КРОМЕ СЛУЧАЯ когда мы ищем
	// Если файлов нет (автопоиск не дал), мы все равно должны показать компонент, чтобы дать возможность поискать вручную!
	// Поэтому убираем проверку displayedFiles.length === 0, или делаем её мягче
	// Но если displayedFiles пусто, то и показывать нечего кроме поиска.
	// Оставим проверку, но будем инициализировать displayedFiles пустым массивом и показывать пустую таблицу? No.
	// Лучше всегда показывать компонент, если он смонтирован.
	// Родитель сейчас решает монтировать или нет (setShowFileSelector).
	// Поэтому убираем return null.

	const selectedFile = displayedFiles[selectedIndex];

	return (
		<Card className="w-full max-w-4xl mx-auto h-full flex flex-col">
			<CardHeader className="py-2 flex-shrink-0 space-y-2">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<FileText className="h-4 w-4" />
						Выбор файла для книги
					</CardTitle>
					<Badge variant="outline" className="text-xs">
						{displayedFiles.length > 0 ? selectedIndex + 1 : 0} из {displayedFiles.length}
					</Badge>
				</div>
				<CardDescription className="text-sm py-1">
					<span>
						<strong>Автор:</strong> {book.author} | <strong>Название:</strong>{" "}
						{book.title}
					</span>
				</CardDescription>

				<div className="flex gap-2">
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.stopPropagation(); // Чтобы не срабатывал глобальный Enter
								handleSearch();
							}
						}}
						placeholder="Поиск файла вручную..."
						className="h-8 text-sm"
					/>
					<Button
						size="sm"
						onClick={handleSearch}
						disabled={isSearching}
					>
						{isSearching ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <SearchIcon className="h-4 w-4" />}
					</Button>
				</div>
			</CardHeader>

			<CardContent className="flex-grow overflow-hidden flex flex-col py-1">
				{/* Список файлов */}
				<div className="border rounded-md flex-grow overflow-hidden flex flex-col">
					<div className="overflow-y-auto flex-grow">
						<div className="p-1 space-y-0.5">
							{displayedFiles.length === 0 && (
								<div className="p-4 text-center text-muted-foreground text-sm">
									Файлы не найдены. Попробуйте изменить поисковый запрос.
								</div>
							)}
							{displayedFiles.map((file, index) => (
								<div
									key={`${book.id}-${file.message_id}-${index}`}
									className={`p-1.5 rounded-md border cursor-pointer transition-colors ${index === selectedIndex
											? "bg-primary/10 border-primary"
											: "bg-muted/50 hover:bg-muted"
										}`}
									onClick={() => setSelectedIndex(index)}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<span className="font-medium text-sm truncate">
													{file.file_name || `Файл ${file.message_id}`}
												</span>
												{file.relevance_score && (
													<Badge variant="secondary" className="text-xs">
														Релевантность: {file.relevance_score}
													</Badge>
												)}
												<Badge variant="outline" className="text-xs">
													ID: {file.message_id}
												</Badge>
											</div>

											<div className="text-xs text-muted-foreground space-y-0.5">
												<div className="flex items-center gap-4">
													<span>Размер: {formatFileSize(file.file_size)}</span>
													<span>Дата: {formatDate(file.date)}</span>
												</div>

												{file.caption && (
													<div className="p-1 bg-muted rounded text-xs truncate">
														{file.caption}
													</div>
												)}
											</div>
										</div>

										<div className="flex flex-col items-end gap-1">
											{file.mime_type && (
												<Badge variant="outline" className="text-xs">
													{file.mime_type.split("/").pop()?.toUpperCase()}
												</Badge>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Подсказка по клавишам управления */}
				<div className="flex justify-center py-2">
					<div className="text-base text-muted-foreground flex items-center gap-4">
						<KbdGroup>
							<Kbd>↑</Kbd>
							<Kbd>↓</Kbd>
							<span>Навигация</span>
						</KbdGroup>
						<KbdGroup>
							<Kbd>Enter</Kbd>
							<span>Выбрать</span>
						</KbdGroup>
						<KbdGroup>
							<Kbd>Esc</Kbd>
							<span>Пропустить</span>
						</KbdGroup>
					</div>
				</div>

				{/* Действия */}
				<div className="flex items-center justify-between pt-2 mt-2">
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSkip}
							disabled={isProcessing}
						>
							<SkipForward className="h-4 w-4 mr-2" />
							Пропустить (Esc)
						</Button>
					</div>

					<div className="text-base text-muted-foreground mx-4">
						Выбран: {selectedFile?.file_name || "Нет"}
					</div>

					<div className="flex items-center gap-2">
						<Button onClick={handleSelect} disabled={isProcessing || displayedFiles.length === 0} size="sm">
							{isProcessing ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
									Загрузка...
								</>
							) : (
								<>
									<Check className="h-4 w-4 mr-2" />
									Выбрать (Enter)
								</>
							)}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
