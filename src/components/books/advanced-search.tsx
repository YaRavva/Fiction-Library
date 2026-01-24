"use client";

import {
	BookOpen,
	Calendar,
	ChevronDown,
	ChevronUp,
	Filter,
	Search,
	SlidersHorizontal,
	Star,
	Tag,
	User,
	X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Типы согласно systemPatterns.md
export interface AdvancedSearchFilters {
	query: string;
	author: string;
	series: string;
	genre: string;
	minRating: number | null;
	maxRating: number | null;
	yearFrom: number | null;
	yearTo: number | null;
	hasFile: boolean | null;
	tags: string[];
	sortBy:
		| "created_at"
		| "title"
		| "author"
		| "rating"
		| "downloads_count"
		| "views_count";
	sortOrder: "asc" | "desc";
}

interface AdvancedSearchProps {
	onSearch: (filters: AdvancedSearchFilters) => void;
	onReset: () => void;
	isLoading?: boolean;
	className?: string;
	values: AdvancedSearchFilters;
	onFilterChange: (filters: AdvancedSearchFilters) => void;
}

// Компонент следует паттернам из systemPatterns.md
export function AdvancedSearch({
	onSearch,
	onReset,
	isLoading = false,
	className = "",
	values,
	onFilterChange,
}: AdvancedSearchProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const handleFilterChange = useCallback(
		(
			key: keyof AdvancedSearchFilters,
			value: AdvancedSearchFilters[keyof AdvancedSearchFilters],
		) => {
			onFilterChange({
				...values,
				[key]: value,
			});
		},
		[values, onFilterChange],
	);

	const handleTagAdd = useCallback(
		(tag: string) => {
			if (tag.trim() && !values.tags.includes(tag.trim())) {
				onFilterChange({
					...values,
					tags: [...values.tags, tag.trim()],
				});
			}
		},
		[values, onFilterChange],
	);

	const handleTagRemove = useCallback(
		(tagToRemove: string) => {
			onFilterChange({
				...values,
				tags: values.tags.filter((tag) => tag !== tagToRemove),
			});
		},
		[values, onFilterChange],
	);

	const handleSearch = useCallback(
		(e?: React.FormEvent) => {
			e?.preventDefault();
			onSearch(values);
		},
		[values, onSearch],
	);

	const handleReset = useCallback(() => {
		onReset();
	}, [onReset]);

	return (
		<Card
			className={cn(
				"border-primary/10 shadow-xl shadow-black/5 bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-300",
				className,
			)}
		>
			<CardContent className="p-4 space-y-4">
				{/* Основная строка поиска */}
				<div className="flex gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Поиск по названию, автору или описанию..."
							value={values.query}
							onChange={(e) => handleFilterChange("query", e.target.value)}
							className="pl-10 h-11 bg-background/50 border-primary/10 focus-visible:ring-primary/30 rounded-xl text-base"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSearch();
								}
							}}
						/>
					</div>
					<Button
						variant="outline"
						onClick={() => setIsExpanded(!isExpanded)}
						className={cn(
							"h-11 px-4 rounded-xl border-primary/10 bg-background/50 hover:bg-background/80 transition-colors",
							isExpanded && "bg-primary/10 text-primary border-primary/20",
						)}
					>
						<SlidersHorizontal className="h-4 w-4 mr-2" />
						<span className="hidden sm:inline">Фильтры</span>
					</Button>
					<Button
						onClick={() => handleSearch()}
						className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all active:scale-95"
						disabled={isLoading}
					>
						{isLoading ? (
							<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
						) : (
							"Найти"
						)}
					</Button>
				</div>

				{/* Сетка дополнительных фильтров */}
				{isExpanded && (
					<div className="space-y-4 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
						<Separator className="opacity-50" />

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
							{/* Автор */}
							<div className="space-y-2">
								<Label
									htmlFor="author"
									className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase"
								>
									<User className="h-3 w-3 text-primary" />
									автор
								</Label>
								<Input
									id="author"
									placeholder="Имя автора"
									value={values.author}
									onChange={(e) => handleFilterChange("author", e.target.value)}
									className="bg-background/40 h-9 text-sm rounded-lg"
								/>
							</div>

							{/* Серия */}
							<div className="space-y-2">
								<Label
									htmlFor="series"
									className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase"
								>
									<BookOpen className="h-3 w-3 text-primary" />
									серия
								</Label>
								<Input
									id="series"
									placeholder="Название серии"
									value={values.series}
									onChange={(e) => handleFilterChange("series", e.target.value)}
									className="bg-background/40 h-9 text-sm rounded-lg"
								/>
							</div>

							{/* Наличие файла */}
							<div className="space-y-2">
								<Label className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase">
									<Filter className="h-3 w-3 text-primary" />
									наличие файла
								</Label>
								<Select
									value={
										values.hasFile === null ? "any" : values.hasFile.toString()
									}
									onValueChange={(value) =>
										handleFilterChange(
											"hasFile",
											value === "any" ? null : value === "true",
										)
									}
								>
									<SelectTrigger className="bg-background/40 h-9 text-sm rounded-lg">
										<SelectValue placeholder="Любые книги" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="any">Любые книги</SelectItem>
										<SelectItem value="true">Только с файлами</SelectItem>
										<SelectItem value="false">Только без файлов</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Рейтинг */}
							<div className="space-y-2">
								<Label className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase">
									<Star className="h-3 w-3 text-primary" />
									рейтинг
								</Label>
								<div className="grid grid-cols-2 gap-2">
									<Select
										value={values.minRating?.toString() || "any"}
										onValueChange={(value) =>
											handleFilterChange(
												"minRating",
												value === "any" ? null : parseInt(value, 10),
											)
										}
									>
										<SelectTrigger className="bg-background/40 h-9 text-sm rounded-lg">
											<SelectValue placeholder="От" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="any">Мин</SelectItem>
											{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
												<SelectItem key={`min-${r}`} value={r.toString()}>
													{r}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={values.maxRating?.toString() || "any"}
										onValueChange={(value) =>
											handleFilterChange(
												"maxRating",
												value === "any" ? null : parseInt(value, 10),
											)
										}
									>
										<SelectTrigger className="bg-background/40 h-9 text-sm rounded-lg">
											<SelectValue placeholder="До" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="any">Макс</SelectItem>
											{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
												<SelectItem key={`max-${r}`} value={r.toString()}>
													{r}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Год */}
							<div className="space-y-2">
								<Label className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase">
									<Calendar className="h-3 w-3 text-primary" />
									год публикации
								</Label>
								<div className="grid grid-cols-2 gap-2">
									<Input
										type="number"
										placeholder="С"
										className="bg-background/40 h-9 text-sm rounded-lg"
										value={values.yearFrom || ""}
										onChange={(e) =>
											handleFilterChange(
												"yearFrom",
												e.target.value ? parseInt(e.target.value) : null,
											)
										}
									/>
									<Input
										type="number"
										placeholder="По"
										className="bg-background/40 h-9 text-sm rounded-lg"
										value={values.yearTo || ""}
										onChange={(e) =>
											handleFilterChange(
												"yearTo",
												e.target.value ? parseInt(e.target.value) : null,
											)
										}
									/>
								</div>
							</div>

							{/* Сортировка */}
							<div className="space-y-2">
								<Label className="text-xs font-semibold text-foreground/80 flex items-center gap-2 lowercase">
									<ChevronDown className="h-3 w-3 text-primary" />
									сортировать по
								</Label>
								<div className="flex gap-2">
									<Select
										value={values.sortBy}
										onValueChange={(v) =>
											handleFilterChange("sortBy", v as any)
										}
									>
										<SelectTrigger className="bg-background/40 h-9 text-sm rounded-lg flex-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="created_at">Новизне</SelectItem>
											<SelectItem value="title">Названию</SelectItem>
											<SelectItem value="author">Автору</SelectItem>
											<SelectItem value="rating">Рейтинг</SelectItem>
											<SelectItem value="downloads_count">
												Скачиваниям
											</SelectItem>
										</SelectContent>
									</Select>
									<Button
										variant="outline"
										size="icon"
										className="h-9 w-9 shrink-0 border-primary/10 bg-background/40 rounded-lg transition-transform active:scale-95"
										onClick={() =>
											handleFilterChange(
												"sortOrder",
												values.sortOrder === "asc" ? "desc" : "asc",
											)
										}
									>
										{values.sortOrder === "desc" ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronUp className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
						</div>

						{/* Теги */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2 text-xs font-semibold text-foreground/80 lowercase">
								<Tag className="h-3 w-3 text-primary" />
								теги
							</Label>
							<div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border border-dashed border-primary/20 bg-primary/5 items-center">
								{values.tags.length === 0 && (
									<span className="text-xs text-muted-foreground italic px-1">
										Теги еще не выбраны...
									</span>
								)}
								{values.tags.map((tag) => (
									<Badge
										key={tag}
										variant="secondary"
										className="pl-2 h-6 gap-1 text-xs bg-background/80 hover:bg-background border-primary/10"
									>
										{tag}
										<button
											onClick={() => handleTagRemove(tag)}
											className="rounded-full hover:bg-destructive/20 p-0.5 transition-colors group"
										>
											<X className="h-2.5 w-2.5 text-muted-foreground group-hover:text-destructive" />
										</button>
									</Badge>
								))}
							</div>
							<Input
								placeholder="Введите название и нажмите Enter..."
								className="bg-background/40 h-9 text-sm rounded-lg placeholder:text-muted-foreground/60"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleTagAdd(e.currentTarget.value);
										e.currentTarget.value = "";
									}
								}}
							/>
						</div>

						{/* Группа кнопок внизу */}
						<div className="flex justify-between items-center pt-2 border-t border-primary/5">
							<Button
								variant="ghost"
								onClick={handleReset}
								className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg px-4 transition-colors"
							>
								<X className="h-3 w-3 mr-2" />
								Сбросить все фильтры
							</Button>

							<div className="text-[10px] text-muted-foreground hidden sm:block italic opacity-60">
								Нажмите Enter в любом поле для быстрого поиска
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
