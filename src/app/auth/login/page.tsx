"use client";

import Link from "next/link";
import { UserAuthForm } from "@/components/auth/user-auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
	return (
		<div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
			<div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
				<div className="absolute inset-0 bg-zinc-900" />
				<div className="relative z-20 flex items-center text-lg font-medium">
					Fiction Library
				</div>
				<div className="relative z-20 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-lg">
							&ldquo;Книги - это уникальный способ жить тысячу жизней... или
							читать одну книгу тысячу раз.&rdquo;
						</p>
						<footer className="text-sm">Бенджамин Франклин</footer>
					</blockquote>
				</div>
			</div>

			<div className="lg:p-8">
				<div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
					<div className="flex flex-col space-y-2 text-center">
						<h1 className="text-2xl font-semibold tracking-tight">
							Добро пожаловать
						</h1>
						<p className="text-sm text-muted-foreground">
							Войдите в свой аккаунт для доступа к библиотеке
						</p>
					</div>

					<UserAuthForm type="login" />

					<p className="px-8 text-center text-sm text-muted-foreground">
						<Link
							href="/auth/register"
							className="hover:text-primary underline underline-offset-4"
						>
							Зарегистрироваться
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
