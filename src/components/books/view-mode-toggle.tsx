"use client";

import { Grid3X3, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "large-cards" | "small-cards" | "table";

interface ViewModeToggleProps {
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({
	viewMode,
	onViewModeChange,
}: ViewModeToggleProps) {
	const getModeIcon = () => {
		switch (viewMode) {
			case "large-cards":
				return <LayoutGrid className="h-4 w-4" />;
			case "small-cards":
				return <Grid3X3 className="h-4 w-4" />;
			case "table":
				return <TableIcon className="h-4 w-4" />;
			default:
				return <LayoutGrid className="h-4 w-4" />;
		}
	};

	const getModeLabel = () => {
		switch (viewMode) {
			case "large-cards":
				return "Большие карточки";
			case "small-cards":
				return "Маленькие карточки";
			case "table":
				return "Таблица";
			default:
				return "Большие карточки";
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2">
					{getModeIcon()}
					<span>{getModeLabel()}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onViewModeChange("large-cards")}>
					<LayoutGrid className="mr-2 h-4 w-4" />
					<span>Большие карточки</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange("small-cards")}>
					<Grid3X3 className="mr-2 h-4 w-4" />
					<span>Маленькие карточки</span>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onViewModeChange("table")}>
					<TableIcon className="mr-2 h-4 w-4" />
					<span>Таблица</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
