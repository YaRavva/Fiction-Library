"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function AccessDeniedPage() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="max-w-md w-full border-destructive/20 shadow-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
						<ShieldAlert className="w-10 h-10 text-destructive" />
					</div>
					<CardTitle className="text-2xl font-bold text-destructive">
						Доступ запрещен
					</CardTitle>
					<CardDescription className="text-base mt-2">
						У вас нет прав для доступа к этому разделу. Обратитесь к
						администратору для получения необходимых разрешений.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button asChild className="w-full" size="lg">
						<Link href="/library">Вернуться в библиотеку</Link>
					</Button>

					<Button asChild variant="ghost" className="w-full">
						<Link href="/">
							<ArrowLeft className="w-4 h-4 mr-2" />
							На главную страницу
						</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
