import {
  BookOpen,
  Library,
  Search,
  Github,
  Loader2,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  type LucideIcon,
} from "lucide-react"

export type Icon = LucideIcon

export const Icons = {
  library: Library,
  reader: BookOpen,
  search: Search,
  gitHub: Github,
  spinner: Loader2,
  chevronLeft: ChevronLeft,
  alertCircle: AlertCircle,
  checkCircle: CheckCircle,
} as const