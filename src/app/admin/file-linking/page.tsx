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
    BookOpen,
    User,
    FileText,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { getValidSession } from "@/lib/auth-helpers";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { useRouter } from "next/navigation";

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

interface LinkResult {
    success: boolean;
    error?: string;
}

export default function FileLinkingPage() {
    const supabase = useState(() => getBrowserSupabase())[0];
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [books, setBooks] = useState<BookWithoutFile[]>([]);
    const [booksLoading, setBooksLoading] = useState(true);
    const [selectedBook, setSelectedBook] = useState<BookWithoutFile | null>(null);
    const [matches, setMatches] = useState<FileMatch[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [linking, setLinking] = useState<string | null>(null);
    const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Auth check
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const session = await getValidSession(supabase);
                if (!session) {
                    router.push("/auth/login");
                    return;
                }
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", session.user.id)
                    .single();
                if (!profile || profile.role !== "admin") {
                    router.push("/library");
                    return;
                }
            } catch {
                setAuthError("Ошибка проверки доступа");
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [supabase, router]);

    // Fetch books without files
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

    // Search matches for selected book
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

    // Link file to book
    const linkFile = async (messageId: number) => {
        if (!selectedBook) return;
        setLinking(String(messageId));
        setLinkResult(null);
        try {
            const res = await fetch("/api/admin/file-linking/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId: selectedBook.id, messageId }),
            });
            const data = await res.json();
            if (!data.error) {
                setLinkResult({ success: true });
                setBooks(prev => prev.filter(b => b.id !== selectedBook.id));
                setSelectedBook(null);
                setMatches(null);
            } else {
                setLinkResult({ success: false, error: data.error });
            }
        } catch {
            setLinkResult({ success: false, error: "Failed to link file" });
        }
        finally { setLinking(null); }
    };

    const filteredBooks = books.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (authError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card><CardContent className="p-6 text-center text-destructive">{authError}</CardContent></Card>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <header className="flex h-14 items-center justify-between border-b px-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <Link2 className="size-5 text-primary" />
                        <h1 className="font-semibold text-lg tracking-tight">File Linking</h1>
                        <span className="text-muted-foreground text-xs">
                            {books.length} книг без файлов
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => router.push("/admin")}>
                            ← Назад
                        </Button>
                        <Button size="sm" variant="outline" onClick={fetchBooks} disabled={booksLoading}>
                            <RefreshCw className={`size-4 ${booksLoading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </header>

                {/* Main split layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT: Book list */}
                    <aside className="flex w-[360px] shrink-0 flex-col border-r">
                        <div className="border-b p-3">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Поиск книги..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {booksLoading ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredBooks.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    {books.length === 0 ? "У всех книг есть файлы" : "Ничего не найдено"}
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredBooks.map(book => (
                                        <button
                                            key={book.id}
                                            type="button"
                                            onClick={() => searchMatches(book)}
                                            className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                                                selectedBook?.id === book.id ? "bg-accent" : ""
                                            }`}
                                        >
                                            <p className="font-medium text-sm truncate leading-tight">{book.title}</p>
                                            <p className="text-muted-foreground text-xs truncate mt-0.5">
                                                <User className="inline size-3 mr-1" />
                                                {book.author}
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
                                <div className="text-center space-y-2">
                                    <Link2 className="mx-auto size-10 opacity-30" />
                                    <p className="text-sm">Выберите книгу слева для поиска файлов</p>
                                </div>
                            </div>
                        ) : searching ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="size-5 animate-spin" />
                                    <span className="text-sm">Поиск совпадений...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 max-w-2xl mx-auto space-y-5">
                                {/* Selected book info */}
                                <Card>
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <h2 className="font-semibold text-base leading-tight">{selectedBook.title}</h2>
                                                <p className="text-muted-foreground text-sm">
                                                    <User className="inline size-3.5 mr-1" />
                                                    {selectedBook.author}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedBook.telegram_post_id && (
                                            <p className="text-muted-foreground text-xs">
                                                Telegram post: #{selectedBook.telegram_post_id}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Match results */}
                                {!matches || matches.length === 0 ? (
                                    <div className="rounded-lg border bg-card p-8 text-center">
                                        <FileText className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                                        <p className="text-muted-foreground text-sm">Нет подходящих файлов</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                            Найдено кандидатов: {matches.length}
                                        </p>
                                        {matches.map(match => (
                                            <CandidateCard
                                                key={match.message_id}
                                                match={match}
                                                linking={linking === String(match.message_id)}
                                                onLink={() => linkFile(match.message_id)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Link result */}
                                {linkResult && (
                                    <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                                        linkResult.success
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-destructive/10 text-destructive"
                                    }`}>
                                        {linkResult.success ? (
                                            <>
                                                <CheckCircle2 className="size-4 shrink-0" />
                                                Файл привязан!
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="size-4 shrink-0" />
                                                {linkResult.error}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </PageTransition>
    );
}

function CandidateCard({
    match,
    linking,
    onLink,
}: {
    match: FileMatch;
    linking: boolean;
    onLink: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {/* Main row */}
                <div className="flex items-start gap-3 p-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Parsed filename */}
                        {match.fileAuthorParsed ? (
                            <div className="text-sm">
                                <span className="font-medium text-primary">{match.fileAuthorParsed}</span>
                                <span className="text-muted-foreground/50 mx-1.5">—</span>
                                <span>{match.fileTitleParsed}</span>
                            </div>
                        ) : (
                            <p className="text-sm font-medium truncate">{match.filename}</p>
                        )}

                        {/* Score bar */}
                        <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden max-w-32">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        match.score >= 60 ? "bg-emerald-500" :
                                        match.score >= 40 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${match.score}%` }}
                                />
                            </div>
                            <span className={`font-mono text-xs font-bold ${
                                match.score >= 60 ? "text-emerald-600" :
                                match.score >= 40 ? "text-amber-600" : "text-red-600"
                            }`}>
                                {match.score}
                            </span>
                        </div>

                        {/* Quick info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                            {match.authorMatch && (
                                <span className="text-emerald-600 font-medium">✓ автор совпадает</span>
                            )}
                            {!match.authorMatch && match.fileAuthorParsed && (
                                <span className="text-amber-600">автор: {match.fileAuthorParsed}</span>
                            )}
                            {match.titleMatchCount > 0 && (
                                <span>совпадений в названии: {match.titleMatchCount}</span>
                            )}
                            <span>слов: {match.matchedWords.join(", ")}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="size-8"
                            onClick={() => setExpanded(!expanded)}
                            title="Детали"
                        >
                            <Search className="size-4" />
                        </Button>
                        <Button
                            size="sm"
                            onClick={onLink}
                            disabled={linking}
                            className="shrink-0 gap-1"
                        >
                            {linking ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <ArrowRight className="size-3.5" />
                            )}
                            Привязать
                        </Button>
                    </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-2 text-xs">
                        <p><span className="text-muted-foreground">Имя файла:</span> {match.filename}</p>
                        {match.fileAuthorParsed && (
                            <p>
                                <span className="text-muted-foreground">Автор (из файла):</span> {match.fileAuthorParsed}
                                <span className="text-muted-foreground ml-3">Книга:</span> {match.fileTitleParsed}
                            </p>
                        )}
                        <p className="text-muted-foreground">
                            message_id: {match.message_id} | score: {match.score} | titleMatchCount: {match.titleMatchCount} | authorMatch: {String(match.authorMatch)}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
