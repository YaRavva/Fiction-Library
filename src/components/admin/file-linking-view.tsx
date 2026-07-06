"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Link2,
    Loader2,
    Search,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface BookWithoutFile {
    id: string;
    title: string;
    author: string;
    telegram_post_id: number | null;
}

interface FileMatch {
    message_id: number;
    filename: string;
    score: number;
    matchedWords: string[];
    titleMatchCount: number;
    authorMatch: boolean;
    fileAuthorParsed?: string;
    fileTitleParsed?: string;
}

export function FileLinkingView() {
    const [books, setBooks] = useState<BookWithoutFile[]>([]);
    const [booksLoading, setBooksLoading] = useState(true);
    const [selectedBook, setSelectedBook] = useState<BookWithoutFile | null>(null);
    const [matches, setMatches] = useState<FileMatch[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [linking, setLinking] = useState<string | null>(null);
    const [linkResult, setLinkResult] = useState<{ bookId: string; success: boolean; error?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchBooks = useCallback(async () => {
        setBooksLoading(true);
        try {
            const res = await fetch("/api/admin/file-linking/books");
            const data = await res.json();
            if (!data.error) setBooks(data.books || []);
        } catch { /* ignore */ }
        finally { setBooksLoading(false); }
    }, []);

    useEffect(() => { fetchBooks(); }, [fetchBooks]);

    const searchMatches = async (book: BookWithoutFile) => {
        setSelectedBook(book);
        setSearching(true);
        setMatches(null);
        setLinkResult(null);
        try {
            const res = await fetch("/api/admin/file-linking/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: book.title, author: book.author, limit: 10 }),
            });
            const data = await res.json();
            if (!data.error) setMatches(data.matches || []);
        } catch { /* ignore */ }
        finally { setSearching(false); }
    };

    const linkFile = async (messageId: number) => {
        if (!selectedBook) return;
        setLinking(String(messageId));
        try {
            const res = await fetch("/api/admin/file-linking/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId: selectedBook.id, messageId }),
            });
            const data = await res.json();
            if (!data.error) {
                setLinkResult({ bookId: selectedBook.id, success: true });
                setBooks(prev => prev.filter(b => b.id !== selectedBook.id));
            } else {
                setLinkResult({ bookId: selectedBook.id, success: false, error: data.error });
            }
        } catch {
            setLinkResult({ bookId: selectedBook.id, success: false, error: "Failed" });
        }
        finally { setLinking(null); }
    };

    const formatAuthorTitle = (author: string, title: string) =>
        `${author} — ${title}`;

    const filteredBooks = books.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full overflow-hidden">
            {/* LEFT: Book list */}
            <aside className="flex w-[380px] shrink-0 flex-col border-r">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        Книги без файлов ({books.length})
                    </span>
                    <Button size="sm" variant="ghost" className="size-7" onClick={fetchBooks} disabled={booksLoading}>
                        <RefreshCw className={`size-3.5 ${booksLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                <div className="border-b p-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {booksLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs">
                            {books.length === 0 ? "У всех книг есть файлы" : "Ничего не найдено"}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredBooks.map(book => (
                                <button
                                    key={book.id}
                                    type="button"
                                    onClick={() => searchMatches(book)}
                                    className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                                        selectedBook?.id === book.id ? "bg-accent" : ""
                                    }`}
                                >
                                    <p className="text-xs font-medium truncate leading-tight">
                                        {formatAuthorTitle(book.author, book.title)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

            {/* RIGHT: File candidates */}
            <main className="flex-1 overflow-y-auto bg-muted/20">
                {!selectedBook ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <div className="text-center space-y-1.5">
                            <Link2 className="mx-auto size-8 opacity-30" />
                            <p className="text-xs">Выберите книгу</p>
                        </div>
                    </div>
                ) : searching ? (
                    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        <span className="text-xs">Поиск...</span>
                    </div>
                ) : (
                    <div className="p-4 max-w-2xl mx-auto space-y-4">
                        {/* Selected book card */}
                        <Card>
                            <CardContent className="p-3">
                                <p className="text-sm font-medium leading-tight">
                                    {formatAuthorTitle(selectedBook.author, selectedBook.title)}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Match candidates */}
                        {!matches || matches.length === 0 ? (
                            <div className="rounded-lg border bg-card p-6 text-center">
                                <p className="text-muted-foreground text-xs">Нет подходящих файлов</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                                    Кандидаты: {matches.length}
                                </p>
                                {matches.map(match => {
                                    const displayAuthor = match.fileAuthorParsed || "";
                                    const displayTitle = match.fileTitleParsed || match.filename;
                                    const scoreColor = match.score >= 60 ? "text-emerald-600" :
                                        match.score >= 40 ? "text-amber-600" : "text-red-600";

                                    return (
                                        <Card key={match.message_id}>
                                            <CardContent className="p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <p className="text-xs font-medium truncate leading-tight">
                                                            {match.fileAuthorParsed
                                                                ? formatAuthorTitle(match.fileAuthorParsed, displayTitle)
                                                                : match.filename
                                                            }
                                                        </p>
                                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                                            <span className={`font-mono font-bold ${scoreColor}`}>
                                                                {match.score}
                                                            </span>
                                                            {match.authorMatch && displayAuthor && (
                                                                <span className="text-emerald-600">✓ автор</span>
                                                            )}
                                                            {!match.authorMatch && displayAuthor && (
                                                                <span className="text-amber-600">автор: {displayAuthor}</span>
                                                            )}
                                                            {match.matchedWords.length > 0 && (
                                                                <span>слова: {match.matchedWords.join(", ")}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={match.score >= 60 ? "default" : "outline"}
                                                        className="shrink-0 h-7 gap-1 text-xs"
                                                        onClick={() => linkFile(match.message_id)}
                                                        disabled={linking === String(match.message_id)}
                                                    >
                                                        {linking === String(match.message_id) ? (
                                                            <Loader2 className="size-3 animate-spin" />
                                                        ) : (
                                                            <ArrowRight className="size-3" />
                                                        )}
                                                        Привязать
                                                    </Button>
                                                </div>

                                                {/* Link result inline */}
                                                {linkResult && linkResult.bookId === selectedBook.id && (
                                                    <div className={`mt-2 flex items-center gap-1.5 rounded-md p-2 text-xs ${
                                                        linkResult.success
                                                            ? "bg-emerald-500/10 text-emerald-600"
                                                            : "bg-destructive/10 text-destructive"
                                                    }`}>
                                                        {linkResult.success ? (
                                                            <><CheckCircle2 className="size-3.5 shrink-0" />Привязан</>
                                                        ) : (
                                                            <><XCircle className="size-3.5 shrink-0" />{linkResult.error}</>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
