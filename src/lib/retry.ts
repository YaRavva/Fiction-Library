/**
 * Retry logic with exponential backoff for API calls
 */

interface RetryOptions {
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		initialDelay = 1000,
		maxDelay = 8000,
		onRetry,
	} = options;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s, ...
				const delay = Math.min(initialDelay * 2 ** attempt, maxDelay);
				console.warn(
					`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`,
					lastError.message,
				);

				if (onRetry) {
					onRetry(attempt + 1, lastError);
				}

				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw lastError;
}
