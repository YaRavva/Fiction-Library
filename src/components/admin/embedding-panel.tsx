"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface EmbeddingModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

interface EmbeddingStats {
    total: number;
    embedded: number;
    pending: number;
}

export function EmbeddingPanel() {
    const [models, setModels] = useState<EmbeddingModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [stats, setStats] = useState<EmbeddingStats | null>(null);
    const [embeddingProgress, setEmbeddingProgress] = useState<{
        embedded: number;
        total: number;
    } | null>(null);

    // Fetch available models
    const fetchModels = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/embedding/models");
            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setModels(data.models || []);
                if (data.models?.length > 0 && !selectedModel) {
                    setSelectedModel(data.models[0].id);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch models");
        }
    }, [selectedModel]);

    // Fetch embedding stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/embedding/stats");
            const data = await response.json();
            if (data.stats) {
                setStats(data.stats);
            }
        } catch (err: any) {
            console.error("Failed to fetch stats:", err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchModels();
        fetchStats();
    }, [fetchModels, fetchStats]);

    // Embed all books
    const handleEmbedAll = async () => {
        if (!selectedModel) {
            setError("Select a model first");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setEmbeddingProgress({ embedded: 0, total: 0 });

        try {
            const response = await fetch("/api/admin/embedding", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: selectedModel, batchSize: 100 }),
            });

            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setSuccess(data.message);
                setEmbeddingProgress({
                    embedded: data.embedded,
                    total: data.total,
                });
                // Refresh stats
                await fetchStats();
            }
        } catch (err: any) {
            setError(err.message || "Failed to embed books");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Brain className="size-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">Vector Embeddings</h2>
                </div>

                <div className="space-y-4">
                    {/* Model Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs">Embedding Model</Label>
                        <Select
                            value={selectedModel}
                            onValueChange={setSelectedModel}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select model..." />
                            </SelectTrigger>
                            <SelectContent>
                                {models.length === 0 ? (
                                    <SelectItem value="none" disabled>
                                        No models available
                                    </SelectItem>
                                ) : (
                                    models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.id}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">
                            {models.length} models available
                        </p>
                    </div>

                    {/* Stats */}
                    {stats && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-muted p-2">
                                <p className="font-semibold text-lg">{stats.total}</p>
                                <p className="text-muted-foreground text-xs">Total</p>
                            </div>
                            <div className="rounded-md bg-muted p-2">
                                <p className="font-semibold text-lg text-emerald-600">
                                    {stats.embedded}
                                </p>
                                <p className="text-muted-foreground text-xs">Embedded</p>
                            </div>
                            <div className="rounded-md bg-muted p-2">
                                <p className="font-semibold text-lg text-amber-600">
                                    {stats.pending}
                                </p>
                                <p className="text-muted-foreground text-xs">Pending</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleEmbedAll}
                            disabled={loading || !selectedModel}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <Brain className="mr-2 size-4" />
                            )}
                            Embed All Books
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                fetchModels();
                                fetchStats();
                            }}
                        >
                            <RefreshCw className="size-4" />
                        </Button>
                    </div>

                    {/* Progress */}
                    {embeddingProgress && (
                        <div className="text-sm">
                            Embedded {embeddingProgress.embedded} of{" "}
                            {embeddingProgress.total} books
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
