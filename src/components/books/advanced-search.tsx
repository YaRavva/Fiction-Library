"use client";

import {
	Calendar,
	ChevronDown,
	ChevronUp,
	FileCheck2,
	Search,
	SlidersHorizontal,
	Star,
	Tag,
	UserRound,
	X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

export function AdvancedSearch({
	onSearch,
	onReset,
	isLoading = false,
	className,
	values,
	onFilterChange,
}: AdvancedSearchProps) {
	const [expanded, setExpanded] = useState(false);

	const handleFilterChange = useCallback(
		<K extends keyof AdvancedSearchFilters>(
			key: K,
			value: AdvancedSearchFilters[K],
		) => {
			onFilterChange({ ...values, [key]: value });
		},
		[values, onFilterChange],
	);

	const addTag = (tag: string) => {
		const cleanTag = tag.trim();
		if (!cleanTag || values.tags.includes(cleanTag)) return;
		onFilterChange({ ...values, tags: [...values.tags, cleanTag] });
	};

	const removeTag = (tag: string) => {
		onFilterChange({
			...values,
			tags: values.tags.filter((item) => item !== tag),
		});
	};

	const runSearch = () => {
		onSearch(values);
	};

	return (
		<section
			className={cn(
				"rounded-lg border bg-card p-3 shadow-sm sm:p-4",
				className,
			)}
		>
			<div className="grid gap-2 lg:grid-cols-[1fr_auto]">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Название, автор, серия, жанр..."
						value={values.query}
						onChange={(event) =>
							handleFilterChange("query", event.target.value)
						}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								runSearch();
							}
						}}
						className="h-10 rounded-md bg-background pl-9"
					/>
				</div>

				<div className="grid grid-cols-2 gap-2 sm:flex">
					<Button
						type="button"
						variant="outline"
						className={cn("h-10", expanded && "bg-accent")}
						onClick={() => setExpanded((value) => !value)}
					>
						<SlidersHorizontal className="size-4" />
						Фильтры
					</Button>
					<Button
						type="button"
						className="h-10"
						onClick={runSearch}
						disabled={isLoading}
					>
						{isLoading ? "Ищем..." : "Найти"}
					</Button>
				</div>
			</div>

			{expanded ? (
				<div className="mt-4 border-t pt-4">
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<div className="space-y-1.5">
							<Label htmlFor="author" className="gap-1.5 text-xs">
								<UserRound className="size-3.5" />
								Автор
							</Label>
							<Input
								id="author"
								value={values.author}
								placeholder="Например, Лукьяненко"
								onChange={(event) =>
									handleFilterChange("author", event.target.value)
								}
								className="h-9"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="series" className="gap-1.5 text-xs">
								<Tag className="size-3.5" />
								Серия
							</Label>
							<Input
								id="series"
								value={values.series}
								placeholder="Название серии"
								onChange={(event) =>
									handleFilterChange("series", event.target.value)
								}
								className="h-9"
							/>
						</div>

						<div className="space-y-1.5">
							<Label className="gap-1.5 text-xs">
								<FileCheck2 className="size-3.5" />
								Файл
							</Label>
							<Select
								value={values.hasFile === null ? "any" : String(values.hasFile)}
								onValueChange={(value) =>
									handleFilterChange(
										"hasFile",
										value === "any" ? null : value === "true",
									)
								}
							>
								<SelectTrigger className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="any">Любые книги</SelectItem>
									<SelectItem value="true">Только с файлом</SelectItem>
									<SelectItem value="false">Без файла</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label className="gap-1.5 text-xs">
								<Star className="size-3.5" />
								Рейтинг
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
									<SelectTrigger className="h-9">
										<SelectValue placeholder="От" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="any">От</SelectItem>
										{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
											<SelectItem key={`min-${rating}`} value={`${rating}`}>
												{rating}
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
									<SelectTrigger className="h-9">
										<SelectValue placeholder="До" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="any">До</SelectItem>
										{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
											<SelectItem key={`max-${rating}`} value={`${rating}`}>
												{rating}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="gap-1.5 text-xs">
								<Calendar className="size-3.5" />
								Год
							</Label>
							<div className="grid grid-cols-2 gap-2">
								<Input
									type="number"
									placeholder="С"
									value={values.yearFrom || ""}
									onChange={(event) =>
										handleFilterChange(
											"yearFrom",
											event.target.value
												? parseInt(event.target.value, 10)
												: null,
										)
									}
									className="h-9"
								/>
								<Input
									type="number"
									placeholder="По"
									value={values.yearTo || ""}
									onChange={(event) =>
										handleFilterChange(
											"yearTo",
											event.target.value
												? parseInt(event.target.value, 10)
												: null,
										)
									}
									className="h-9"
								/>
							</div>
						</div>

						<div className="space-y-1.5 md:col-span-2 xl:col-span-3">
							<Label htmlFor="tag-input" className="gap-1.5 text-xs">
								<Tag className="size-3.5" />
								Теги
							</Label>
							<div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
								{values.tags.map((tag) => (
									<Badge key={tag} variant="secondary" className="gap-1">
										{tag}
										<button type="button" onClick={() => removeTag(tag)}>
											<X className="size-3" />
										</button>
									</Badge>
								))}
								<input
									id="tag-input"
									className="min-w-36 flex-1 bg-transparent px-1 text-sm outline-none"
									placeholder="Добавить тег и Enter"
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											addTag(event.currentTarget.value);
											event.currentTarget.value = "";
										}
									}}
								/>
							</div>
						</div>

						<div className="space-y-1.5 md:col-span-2 xl:col-span-2">
							<Label className="gap-1.5 text-xs">Сортировка</Label>
							<div className="flex gap-2">
								<Select
									value={values.sortBy}
									onValueChange={(value) =>
										handleFilterChange(
											"sortBy",
											value as AdvancedSearchFilters["sortBy"],
										)
									}
								>
									<SelectTrigger className="h-9">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="created_at">По новизне</SelectItem>
										<SelectItem value="title">По названию</SelectItem>
										<SelectItem value="author">По автору</SelectItem>
										<SelectItem value="rating">По рейтингу</SelectItem>
										<SelectItem value="downloads_count">
											По скачиваниям
										</SelectItem>
										<SelectItem value="views_count">По просмотрам</SelectItem>
									</SelectContent>
								</Select>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-9 w-9"
									onClick={() =>
										handleFilterChange(
											"sortOrder",
											values.sortOrder === "asc" ? "desc" : "asc",
										)
									}
								>
									{values.sortOrder === "desc" ? (
										<ChevronDown className="size-4" />
									) : (
										<ChevronUp className="size-4" />
									)}
								</Button>
							</div>
						</div>
					</div>

					<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
						<Button
							type="button"
							variant="ghost"
							className="text-muted-foreground hover:text-destructive"
							onClick={onReset}
						>
							<X className="size-4" />
							Сбросить
						</Button>
						<Button type="button" onClick={runSearch} disabled={isLoading}>
							Применить фильтры
						</Button>
					</div>
				</div>
			) : null}
		</section>
	);
}
