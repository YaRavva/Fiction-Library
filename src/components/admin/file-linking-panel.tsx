"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Link2,
    Loader2,
    Search,
    CheckCircle2,
    XCircle,
    AlertCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

interface LinkResult {
    bookId: string;
    messageId: number;
    success: boolean;
    error?: string;
}

export function FileLinkingPanel() {
    const [books, setBooks] = useState<BookWithoutFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [expandedBook, setExpandedBook] = useState<string | null>(null);
    const [matches, setMatches] = useState<Record<string, FileMatch[]>>({});
    const [searching, setSearching] = useState<Record<string, boolean>>({});
    const [linking, setLinking] = useState<Record<string, boolean>>({});
    const [linkResults, setLinkResults] = useState<Record<string, LinkResult>>({});
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch books without files
    const fetchBooks = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/file-linking/books");
            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setBooks(data.books || []);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch books");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    // Search for file matches for a book
    const searchMatches = async (book: BookWithoutFile) => {
        setSearching((prev) => ({ ...prev, [book.id]: true }));

        try {
            const response = await fetch("/api/admin/file-linking/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: book.title,
                    author: book.author,
                    limit: 5,
                }),
            });

            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setMatches((prev) => ({ ...prev, [book.id]: data.matches || [] }));
            }
        } catch (err: any) {
            setError(err.message || "Failed to search matches");
        } finally {
            setSearching((prev) => ({ ...prev, [book.id]: false }));
        }
    };

    // Link a file to a book
    const linkFile = async (bookId: string, messageId: number) => {
        setLinking((prev) => ({ ...prev, [bookId]: true }));

        try {
            const response = await fetch("/api/admin/file-linking/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId, messageId }),
            });

            const data = await response.json();

            setLinkResults((prev) => ({
                ...prev,
                [bookId]: {
                    bookId,
                    messageId,
                    success: !data.error,
                    error: data.error,
                },
            }));

            if (!data.error) {
                setSuccess(`File linked successfully!`);
                // Remove book from list
                setBooks((prev) => prev.filter((b) => b.id !== bookId));
            }
        } catch (err: any) {
            setLinkResults((prev) => ({
                ...prev,
                [bookId]: {
                    bookId,
                    messageId,
                    success: false,
                    error: err.message || "Failed to link file",
                },
            }));
        } finally {
            setLinking((prev) => ({ ...prev, [bookId]: false }));
        }
    };

    // Filter books by search query
    const filteredBooks = books.filter(
        (book) =>
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Card>
            <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link2 className="size-4 text-muted-foreground" />
                        <h2 className="font-semibold text-sm">File Linking</h2>
                        <span className="text-muted-foreground text-xs">
                            ({books.length} books without files)
                        </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchBooks}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>

                <div className="space-y-4">
                    {/* Search */}
                    <div className="space-y-2">
                        <Label className="text-xs">Search Books</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by title or author..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    {/* Books List */}
                    {loading ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredBooks.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                            {books.length === 0
                                ? "All books have files!"
                                : "No books match your search"}
                        </div>
                    ) : (
                        <div className="max-h-96 space-y-2 overflow-y-auto">
                            {filteredBooks.map((book) => (
                                <div
                                    key={book.id}
                                    className="rounded-md border p-3"
                                >
                                    {/* Book Header */}
                                    <div
                                        className="flex cursor-pointer items-center justify-between"
                                        onClick={() => {
                                            setExpandedBook(
                                                expandedBook === book.id ? null : book.id
                                            );
                                            if (
                                                expandedBook !== book.id &&
                                                !matches[book.id]
                                            ) {
                                                searchMatches(book);
                                            }
                                        }}
                                    >
                                        <div className="flex-1 truncate">
                                            <p className="font-medium text-sm truncate">
                                                {book.title}
                                            </p>
                                            <p className="text-muted-foreground text-xs truncate">
                                                {book.author}
                                            </p>
                                        </div>
                                        {expandedBook === book.id ? (
                                            <ChevronUp className="size-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="size-4 text-muted-foreground" />
                                        )}
                                    </div>

                                    {/* Expanded Content */}
                                    {expandedBook === book.id && (
                                        <div className="mt-3 space-y-2 border-t pt-3">
                                            {searching[book.id] ? (
                                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                    <Loader2 className="size-4 animate-spin" />
                                                    Searching for matches...
                                                </div>
                                            ) : matches[book.id]?.length === 0 ? (
                                                <p className="text-muted-foreground text-sm">
                                                    No matching files found
                                                </p>
                                            ) : (
                                                matches[book.id]?.map((match) => (
                                                    <div
                                                        key={match.message_id}
                                                        className="flex items-center justify-between rounded-md bg-muted p-2"
                                                    >
                                                        <div className="flex-1 truncate">
                                                            <p className="font-medium text-xs truncate">
                                                                {match.filename}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                Score: {match.score.toFixed(1)} |{" "}
                                                                Matched: {match.matchedWords.join(", ")}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                linkFile(book.id, match.message_id)
                                                            }
                                                            disabled={linking[book.id]}
                                                        >
                                                            {linking[book.id] ? (
                                                                <Loader2 className="size-4 animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 className="size-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                ))
                                            )}

                                            {/* Link Result */}
                                            {linkResults[book.id] && (
                                                <div
                                                    className={`flex items-center gap-2 rounded-md p-2 text-sm ${
                                                        linkResults[book.id].success
                                                            ? "bg-emerald-500/10 text-emerald-600"
                                                            : "bg-destructive/10 text-destructive"
                                                    }`}
                                                >
                                                    {linkResults[book.id].success ? (
                                                        <>
                                                            <CheckCircle2 className="size-4" />
                                                            File linked successfully!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="size-4" />
                                                            {linkResults[book.id].error}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-destructive text-sm">
                            <AlertCircle className="size-4" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-2 text-emerald-600 text-sm">
                            <CheckCircle2 className="size-4" />
                            {success}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
