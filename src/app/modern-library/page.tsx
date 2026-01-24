"use client";

import {
	Book,
	ChevronRight,
	Compass,
	Home,
	LogOut,
	Menu,
	Settings,
	User,
	X,
} from "lucide-react";
import { useState } from "react";
import { ModernBookCard } from "@/components/modern/ModernBookCard";
import { ModernHero } from "@/components/modern/ModernHero";
import { ModernSidebar } from "@/components/modern/ModernSidebar";
import { Button } from "@/components/ui/button";

// Mock data
const MOCK_BOOKS = [
	{
		id: "1",
		title: "Атомные привычки",
		author: "Джеймс Клир",
		rating: 4.8,
		year: 2018,
		format: "EPUB",
		coverUrl:
			"https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "2",
		title: "Дюна",
		author: "Фрэнк Герберт",
		rating: 4.9,
		year: 1965,
		format: "FB2",
		coverUrl:
			"https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "3",
		title: "Задача трёх тел",
		author: "Лю Цысинь",
		rating: 4.7,
		year: 2008,
		format: "PDF",
		coverUrl:
			"https://images.unsplash.com/photo-1614726365723-49cfaeb63682?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "4",
		title: "1984",
		author: "Джордж Оруэлл",
		rating: 4.9,
		year: 1949,
		format: "FB2",
		coverUrl:
			"https://images.unsplash.com/photo-1535905557558-afc4877a26fc?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "5",
		title: "Думай медленно... решай быстро",
		author: "Даниэль Канеман",
		rating: 4.6,
		year: 2011,
		format: "EPUB",
	},
	{
		id: "6",
		title: "Sapiens: Краткая история человечества",
		author: "Юваль Ной Харари",
		rating: 4.8,
		year: 2011,
		format: "PDF",
		coverUrl:
			"https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
	},
];

const RECENT_BOOKS = [
	{
		id: "7",
		title: "Гарри Поттер и философский камень",
		author: "Дж. К. Роулинг",
		rating: 4.9,
		year: 1997,
		format: "FB2",
		coverUrl:
			"https://images.unsplash.com/photo-1609866138210-84bb6969a3c9?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "8",
		title: "Властелин Колец",
		author: "Дж. Р. Р. Толкин",
		rating: 5.0,
		year: 1954,
		format: "EPUB",
		coverUrl:
			"https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?auto=format&fit=crop&q=80&w=600",
	},
	{
		id: "9",
		title: "Марсианин",
		author: "Энди Вейер",
		rating: 4.7,
		year: 2011,
		format: "FB2",
	},
];

export default function ModernLibraryPage() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const menuItems = [
		{ icon: Home, label: "Главная", active: true },
		{ icon: Compass, label: "Обзор", active: false },
		{ icon: Book, label: "Мои книги", active: false },
		{ icon: User, label: "Профиль", active: false },
	];

	return (
		<div className="flex min-h-screen bg-background font-sans selection:bg-primary/20">
			<ModernSidebar />

			<main className="flex-1 overflow-x-hidden">
				{/* Mobile Header */}
				<header className="lg:hidden flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-xl sticky top-0 z-50">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
							<Book className="w-5 h-5 text-primary-foreground" />
						</div>
						<span className="font-bold text-lg">FictionLib</span>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsMobileMenuOpen(true)}
					>
						<Menu className="h-6 w-6" />
					</Button>
				</header>

				{/* Mobile Menu Overlay */}
				{isMobileMenuOpen && (
					<div className="fixed inset-0 z-50 lg:hidden bg-background/80 backdrop-blur-sm">
						<div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-card border-l shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-200">
							<div className="flex items-center justify-between mb-8">
								<span className="font-bold text-xl">Меню</span>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setIsMobileMenuOpen(false)}
								>
									<X className="h-6 w-6" />
								</Button>
							</div>
							<nav className="flex-1 space-y-2">
								{menuItems.map((item) => (
									<Button
										key={item.label}
										variant={item.active ? "secondary" : "ghost"}
										className="w-full justify-start gap-3 h-12 rounded-xl text-lg font-medium"
									>
										<item.icon className="w-5 h-5" />
										{item.label}
									</Button>
								))}
							</nav>
							<div className="mt-auto pt-6 border-t space-y-2">
								<Button
									variant="ghost"
									className="w-full justify-start gap-3 h-12 rounded-xl text-muted-foreground"
								>
									<Settings className="w-5 h-5" />
									Настройки
								</Button>
								<Button
									variant="ghost"
									className="w-full justify-start gap-3 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
								>
									<LogOut className="w-5 h-5" />
									Выйти
								</Button>
							</div>
						</div>
					</div>
				)}

				<ModernHero />

				<div className="container mx-auto px-4 pb-20 space-y-16">
					{/* Section: Currently Popular */}
					<section>
						<div className="flex items-center justify-between mb-8">
							<div>
								<h2 className="text-2xl font-bold tracking-tight">
									Популярное сейчас
								</h2>
								<p className="text-muted-foreground text-sm">
									Самые читаемые книги этой недели
								</p>
							</div>
							<Button
								variant="ghost"
								className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
							>
								Смотреть все <ChevronRight className="w-4 h-4" />
							</Button>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
							{MOCK_BOOKS.map((book, i) => (
								<ModernBookCard key={book.id} book={book} index={i} />
							))}
						</div>
					</section>

					{/* Section: New Arrivals */}
					<section>
						<div className="flex items-center justify-between mb-8">
							<div>
								<h2 className="text-2xl font-bold tracking-tight">Новинки</h2>
								<p className="text-muted-foreground text-sm">
									Последние поступления в библиотеку
								</p>
							</div>
							<Button
								variant="ghost"
								className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
							>
								Смотреть все <ChevronRight className="w-4 h-4" />
							</Button>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
							{RECENT_BOOKS.map((book, i) => (
								<ModernBookCard key={book.id} book={book} index={i} />
							))}
						</div>
					</section>

					{/* Section: Categories / Genres */}
					<section>
						<h2 className="text-2xl font-bold tracking-tight mb-8">Жанры</h2>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[
								"Фантастика",
								"Детективы",
								"Романы",
								"Психология",
								"Бизнес",
								"История",
								"Наука",
								"Детское",
							].map((genre) => (
								<div
									key={genre}
									className="h-24 rounded-xl bg-gradient-to-br from-card to-muted border p-6 flex items-center justify-center font-semibold text-lg hover:scale-[1.02] hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
								>
									<div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
									{genre}
								</div>
							))}
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
