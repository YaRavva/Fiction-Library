"use client";

import { Check, FileText, SkipForward } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

export function FileSelector({
	book,
	files,
	onSelect,
	onSkip,
}: FileSelectorProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);

	// Инициализация при изменении файлов
	useEffect(() => {
		setSelectedIndex(0);
	}, [files]);

	const handleSelect = useCallback(() => {
		if (isProcessing || selectedIndex >= files.length) return;

		setIsProcessing(true);
		onSelect(files[selectedIndex]);
	}, [isProcessing, selectedIndex, files, onSelect]);

	const handleSkip = useCallback(() => {
		if (isProcessing) return;

		setIsProcessing(true);
		onSkip();
	}, [isProcessing, onSkip]);

	const formatFileSize = (size?: number) => {
		if (!size) return "Unknown size";
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	};

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString("ru-RU", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Обработчик клавиш
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					setSelectedIndex((prev) => Math.max(0, prev - 1));
					break;

				case "ArrowDown":
					event.preventDefault();
					setSelectedIndex((prev) => Math.min(files.length - 1, prev + 1));
					break;

				case "Enter":
					event.preventDefault();
					handleSelect();
					break;

				case "s":
				case "S":
					if (!event.ctrlKey && !event.metaKey) {
						event.preventDefault();
						handleSkip();
					}
					break;

				case "Escape":
					event.preventDefault();
					handleSkip();
					break;
			}
		},
		[files.length, handleSelect, handleSkip],
	);

	// Подписка на клавиатуру
	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Скролл к выбранному элементу
	useEffect(() => {
		const element = document.querySelector(
			`[data-file-index="${selectedIndex}"]`,
		);
		element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [selectedIndex]);

	return (
		<Card className="w-full max-w-4xl mx-auto h-full flex flex-col">
			<CardHeader className="py-2 flex-shrink-0">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<FileText className="h-4 w-4" />
						Выбор файла для книги
					</CardTitle>
					<Badge variant="outline" className="text-xs">
						{files.length > 0 ? selectedIndex + 1 : 0} из {files.length}
					</Badge>
				</div>
				<CardDescription className="text-sm py-1">
					<span className="font-medium text-gray-900">
						{book.author} — {book.title}
					</span>
				</CardDescription>
			</CardHeader>

			<CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
				{files.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
						<FileText className="h-12 w-12 mb-4 opacity-50" />
						<p className="text-lg font-medium">Файлы не найдены</p>
						<p className="text-sm">
							Проверьте индекс файлов или запустите индексацию
						</p>
					</div>
				) : (
					files.map((file, index) => (
						<div
							key={`${file.message_id}-${index}`}
							data-file-index={index}
							className={`p-3 rounded-lg border cursor-pointer transition-all ${
								index === selectedIndex
									? "bg-blue-50 border-blue-500 ring-2 ring-blue-200"
									: "bg-white border-gray-200 hover:bg-gray-50"
							}`}
							onClick={() => setSelectedIndex(index)}
							onDoubleClick={handleSelect}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm truncate">
										{file.file_name || `Файл #${file.message_id}`}
									</div>
									<div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
										<span>{formatFileSize(file.file_size)}</span>
										<span>•</span>
										<span>{formatDate(file.date)}</span>
										{file.mime_type && (
											<>
												<span>•</span>
												<span>{file.mime_type}</span>
											</>
										)}
									</div>
									{file.caption && (
										<div className="text-xs text-gray-600 mt-1 line-clamp-2">
											{file.caption}
										</div>
									)}
								</div>
								<div className="flex items-center gap-2">
									{file.relevance_score && (
										<Badge
											variant={
												file.relevance_score >= 80
													? "default"
													: file.relevance_score >= 60
														? "secondary"
														: "outline"
											}
											className="text-xs"
										>
											{file.relevance_score}%
										</Badge>
									)}
									{index === selectedIndex && (
										<Check className="h-4 w-4 text-blue-600" />
									)}
								</div>
							</div>
						</div>
					))
				)}
			</CardContent>

			<div className="p-3 border-t bg-gray-50 flex-shrink-0">
				<div className="flex items-center justify-between gap-3">
					<KbdGroup>
						<Kbd>↑↓</Kbd> навигация
						<Kbd>Enter</Kbd> выбрать
						<Kbd>S</Kbd> пропустить
					</KbdGroup>

					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSkip}
							disabled={isProcessing}
						>
							<SkipForward className="h-3 w-3 mr-1" />
							Пропустить
						</Button>
						<Button
							size="sm"
							onClick={handleSelect}
							disabled={isProcessing || files.length === 0}
						>
							<Check className="h-3 w-3 mr-1" />
							Выбрать
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}
