import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
	if (!browserClient) {
		browserClient = createBrowserClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		);

		// Подписываемся на события авторизации для обработки ошибок
		browserClient.auth.onAuthStateChange(
			(event: AuthChangeEvent, _session: Session | null) => {
				if (event === "TOKEN_REFRESHED") {
					console.log("Token refreshed successfully");
				} else if (event === "SIGNED_OUT") {
					console.log("User signed out");
				}
			},
		);
	}

	return browserClient;
}
