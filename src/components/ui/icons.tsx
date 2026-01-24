import {
	AlertCircle,
	BookOpen,
	CheckCircle,
	ChevronLeft,
	Github,
	Library,
	Loader2,
	type LucideIcon,
	Search,
} from "lucide-react";

export type Icon = LucideIcon;

export const Icons = {
	library: Library,
	reader: BookOpen,
	search: Search,
	gitHub: Github,
	spinner: Loader2,
	chevronLeft: ChevronLeft,
	alertCircle: AlertCircle,
	checkCircle: CheckCircle,
} as const;
