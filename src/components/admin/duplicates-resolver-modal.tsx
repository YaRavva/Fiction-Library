"use client";

import {
	AlertCircle,
	CheckCircle2,
	FileText,
	Loader2,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrowserSupabase } from "@/lib/browserSupabase";

interface DuplicateGroup {
	author: string;
	title: string;
	books: {
		id: string;
		created_at: string;
		file_url: string | null;
		file_size: number | null;
		file_format: string | null;
		description: string;
		cover_url: string;
		is_newest: boolean;
	}[];
}

interface DuplicatesResolverModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function DuplicatesResolverModal({
	isOpen,
	onClose,
}: DuplicatesResolverModalProps) {
	const [loading, setLoading] = useState(false);
	const [groups, setGroups] = useState<DuplicateGroup[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
	const [resolving, setResolving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<{ processed: number; deleted: number }>({
		processed: 0,
		deleted: 0,
	});

	const supabase = getBrowserSupabase();

	// Load duplicates when opened
	useEffect(() => {
		if (isOpen) {
			loadDuplicates();
		} else {
			// Reset state on close
			setGroups([]);
			setCurrentIndex(0);
			setSelectedBookId(null);
			setStats({ processed: 0, deleted: 0 });
			setError(null);
		}
	}, [isOpen]);

	const loadDuplicates = async () => {
		setLoading(true);
		setError(null);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) throw new Error("No session");

			const response = await fetch("/api/admin/duplicates", {
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			if (!response.ok) throw new Error("Failed to fetch duplicates");

			const data = await response.json();
			setGroups(data.duplicateGroups || []);

			// Pre-select the newest book for the first group
			if (data.duplicateGroups && data.duplicateGroups.length > 0) {
				const firstGroup = data.duplicateGroups[0];
				const newest =
					firstGroup.books.find((b: { is_newest: boolean }) => b.is_newest) ||
					firstGroup.books[0];
				setSelectedBookId(newest.id);
			}
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleResolve = async () => {
		if (!selectedBookId || groups.length === 0) return;

		setResolving(true);
		try {
			const currentGroup = groups[currentIndex];
			const idsToDelete = currentGroup.books
				.filter((b) => b.id !== selectedBookId)
				.map((b) => b.id);

			if (idsToDelete.length > 0) {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session) throw new Error("No session");

				const response = await fetch("/api/admin/duplicates/resolve", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${session.access_token}`,
					},
					body: JSON.stringify({ idsToDelete }),
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to delete duplicates");
				}

				setStats((prev) => ({
					processed: prev.processed + 1,
					deleted: prev.deleted + idsToDelete.length,
				}));
			}

			// Move to next group
			if (currentIndex < groups.length - 1) {
				const nextIndex = currentIndex + 1;
				setCurrentIndex(nextIndex);
				const nextGroup = groups[nextIndex];
				const newest =
					nextGroup.books.find((b) => b.is_newest) || nextGroup.books[0];
				setSelectedBookId(newest.id);
			} else {
				// Done
				setCurrentIndex(groups.length); // Signals completion
			}
		} catch (err: any) {
			setError(`Error resolving group: ${err.message}`);
		} finally {
			setResolving(false);
		}
	};

	const currentGroup = groups[currentIndex];
	const isFinished =
		!loading && groups.length > 0 && currentIndex >= groups.length;
	const isNoDuplicates = !loading && groups.length === 0;

	// Helper for file size
	const formatSize = (bytes: number | null) => {
		if (bytes === null) return "Unknown size";
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	// Helper for filename
	const getFilename = (url: string | null) => {
		if (!url) return "No file";
		return url.split("/").pop() || url;
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Управление дубликатами</DialogTitle>
					<DialogDescription>
						Выберите версию книги, которую хотите оставить. Остальные будут
						удалены.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-hidden py-4">
					{loading && (
						<div className="flex flex-col items-center justify-center h-64 space-y-4">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="text-muted-foreground">Поиск дубликатов...</p>
						</div>
					)}

					{error && !loading && (
						<div className="flex flex-col items-center justify-center h-64 space-y-4 text-destructive">
							<AlertCircle className="h-10 w-10" />
							<p>{error}</p>
							<Button variant="outline" onClick={loadDuplicates}>
								Повторить
							</Button>
						</div>
					)}

					{isNoDuplicates && (
						<div className="flex flex-col items-center justify-center h-64 space-y-4">
							<CheckCircle2 className="h-12 w-12 text-green-500" />
							<p className="text-xl font-medium">Дубликатов не найдено!</p>
							<p className="text-muted-foreground">Ваша библиотека чиста.</p>
						</div>
					)}

					{isFinished && (
						<div className="flex flex-col items-center justify-center h-64 space-y-4">
							<CheckCircle2 className="h-12 w-12 text-primary" />
							<p className="text-xl font-medium">Все дубликаты обработаны!</p>
							<div className="text-sm text-muted-foreground text-center">
								<p>Обработано групп: {groups.length}</p>
								<p>Удалено книг: {stats.deleted}</p>
							</div>
						</div>
					)}

					{!loading &&
						!error &&
						!isNoDuplicates &&
						!isFinished &&
						currentGroup && (
							<div className="space-y-6 h-full flex flex-col">
								<div className="flex items-center justify-between border-b pb-4 shrink-0">
									<div>
										<h3 className="text-lg font-bold">{currentGroup.title}</h3>
										<p className="text-muted-foreground">
											{currentGroup.author}
										</p>
									</div>
									<Badge variant="outline">
										{currentIndex + 1} из {groups.length}
									</Badge>
								</div>

								<ScrollArea className="flex-1 pr-4">
									<RadioGroup
										value={selectedBookId || ""}
										onValueChange={setSelectedBookId}
									>
										<div className="space-y-3">
											{currentGroup.books.map((book) => (
												<div
													key={book.id}
													className={`
													flex items-start space-x-3 space-y-0 rounded-lg border p-4 transition-colors
													${selectedBookId === book.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}
												`}
												>
													<RadioGroupItem
														value={book.id}
														id={book.id}
														className="mt-1"
													/>
													<div
														className="flex-1 space-y-2 cursor-pointer"
														onClick={() => setSelectedBookId(book.id)}
													>
														<div className="flex items-center justify-between">
															<Label
																htmlFor={book.id}
																className="font-medium cursor-pointer flex items-center gap-2"
															>
																<FileText className="h-4 w-4 text-muted-foreground" />
																{getFilename(book.file_url)}
															</Label>
															{book.is_newest && (
																<Badge variant="secondary" className="text-xs">
																	Новейшая
																</Badge>
															)}
														</div>
														<div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
															{book.file_url && (
																<>
																	<div>
																		Размер:{" "}
																		<span className="font-mono text-foreground">
																			{formatSize(book.file_size)}
																		</span>
																	</div>
																	<div>
																		Формат:{" "}
																		<span className="uppercase">
																			{book.file_format || "?"}
																		</span>
																	</div>
																</>
															)}
															<div>
																Создана:{" "}
																{new Date(book.created_at).toLocaleDateString()}
															</div>
															<div className="flex items-center gap-2">
																Обложка:{" "}
																{book.cover_url !== "НЕТ"
																	? "✅ Есть"
																	: "❌ Нет"}
															</div>
														</div>
														{selectedBookId !== book.id && (
															<div className="bg-destructive/10 text-destructive text-xs py-1 px-2 rounded-md inline-flex items-center gap-1 mt-2">
																<Trash2 className="h-3 w-3" /> Будет удалена
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									</RadioGroup>
								</ScrollArea>
							</div>
						)}
				</div>

				<DialogFooter className="pt-4 border-t shrink-0">
					{isFinished || isNoDuplicates ? (
						<Button onClick={onClose} className="w-full sm:w-auto">
							Закрыть
						</Button>
					) : (
						<>
							<Button variant="outline" onClick={onClose} disabled={resolving}>
								Отмена
							</Button>
							{!loading && !error && (
								<Button
									onClick={handleResolve}
									disabled={resolving || !selectedBookId}
								>
									{resolving ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Обработка...
										</>
									) : (
										"Оставить выбранную и продолжить"
									)}
								</Button>
							)}
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
