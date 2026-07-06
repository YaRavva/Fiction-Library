"use client";

import { Grid3X3, Rows3, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "large-cards" | "small-cards" | "table";

interface ViewModeToggleProps {
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
}

const modes = [
	{ value: "large-cards", label: "Список", icon: Rows3 },
	{ value: "small-cards", label: "Плитка", icon: Grid3X3 },
	{ value: "table", label: "Таблица", icon: TableIcon },
] as const;

export function ViewModeToggle({
	viewMode,
	onViewModeChange,
}: ViewModeToggleProps) {
	return (
		<div className="inline-flex rounded-md border bg-card p-1 shadow-sm">
			{modes.map((mode) => {
				const Icon = mode.icon;
				const active = viewMode === mode.value;

				return (
					<Button
						key={mode.value}
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"h-8 rounded-sm px-2.5 text-xs",
							active &&
								"bg-primary text-primary-foreground hover:bg-primary/90",
						)}
						onClick={() => onViewModeChange(mode.value)}
					>
						<Icon className="size-3.5" />
						<span className="hidden sm:inline">{mode.label}</span>
					</Button>
				);
			})}
		</div>
	);
}
