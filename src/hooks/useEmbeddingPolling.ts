"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { withRetry } from "@/lib/retry";

interface EmbeddingStats {
	books: {
		total: number;
		embedded: number;
		pending: number;
	};
	files: {
		total: number;
		embedded: number;
		pending: number;
	};
	schema: {
		booksEmbeddingReady: boolean;
		filesEmbeddingReady: boolean;
		migrationRequired: boolean;
	};
}

interface UseEmbeddingPollingOptions {
	pollInterval?: number;
	enabled?: boolean;
	onStatsUpdate?: (stats: EmbeddingStats) => void;
}

export function useEmbeddingPolling(options: UseEmbeddingPollingOptions = {}) {
	const { pollInterval = 5000, enabled = true, onStatsUpdate } = options;

	const [stats, setStats] = useState<EmbeddingStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPolling, setIsPolling] = useState(false);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const supabase = getBrowserSupabase();

	const fetchStats = useCallback(async () => {
		try {
			setError(null);

			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session) return null;

			const data = await withRetry(
				async () => {
					const response = await fetch("/api/admin/embedding/stats", {
						headers: { Authorization: `Bearer ${session.access_token}` },
					});

					if (!response.ok) {
						throw new Error(`HTTP error: ${response.status}`);
					}

					return response.json();
				},
				{
					maxRetries: 3,
					onRetry: (attempt, err) => {
						console.warn(
							`Embedding stats fetch retry ${attempt}:`,
							err.message,
						);
					},
				},
			);

			if (data?.stats) {
				setStats(data.stats);
				onStatsUpdate?.(data.stats);
				return data.stats;
			}
			return null;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			console.error("Error fetching embedding stats:", err);
			return null;
		}
	}, [supabase, onStatsUpdate]);

	const startPolling = useCallback(() => {
		if (intervalRef.current) return;

		setIsPolling(true);
		intervalRef.current = setInterval(fetchStats, pollInterval);
	}, [fetchStats, pollInterval]);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	// Auto-fetch on mount
	useEffect(() => {
		if (!enabled) return;

		setLoading(true);
		fetchStats().finally(() => setLoading(false));
	}, [enabled, fetchStats]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	return {
		stats,
		loading,
		error,
		isPolling,
		fetchStats,
		startPolling,
		stopPolling,
	};
}
