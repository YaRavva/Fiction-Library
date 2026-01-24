export const dynamic = "force-dynamic";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="text-center space-y-6 max-w-md mx-auto">
				<div className="flex justify-center">
					<div className="p-4 bg-primary/10 rounded-full animate-bounce">
						<FileQuestion className="h-12 w-12 text-primary" />
					</div>
				</div>

				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
						Страница не найдена
					</h1>
					<p className="text-muted-foreground">
						К сожалению, запрашиваемая страница не существует или была
						перемещена.
					</p>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button asChild size="lg" className="w-full sm:w-auto">
						<Link href="/">На главную</Link>
					</Button>
					<Button
						asChild
						variant="outline"
						size="lg"
						className="w-full sm:w-auto"
					>
						<Link href="/library">В библиотеку</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
