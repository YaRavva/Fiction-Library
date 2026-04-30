"use client";

export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="ru">
			<body>
				<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "#111827", color: "#f9fafb" }}>
					<div style={{ width: "100%", maxWidth: "28rem", borderRadius: "0.75rem", border: "1px solid #374151", background: "#1f2937", padding: "1.5rem", textAlign: "center" }}>
						<h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Что-то пошло не так</h1>
						<p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#d1d5db" }}>
							Попробуйте обновить страницу или повторить действие позже.
						</p>
						<button
							type="button"
							onClick={reset}
							style={{ marginTop: "1.5rem", height: "2.5rem", borderRadius: "0.5rem", border: 0, background: "#f59e0b", padding: "0 1rem", color: "#111827", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
						>
							Повторить
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
