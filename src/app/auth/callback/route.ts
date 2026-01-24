import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const _next = searchParams.get("next");

	if (code) {
		const cookieStore = await cookies();
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					},
				},
			},
		);

		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Создаем профиль пользователя если он не существует
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (user) {
				// Проверяем, существует ли профиль пользователя
				const { data: existingProfile } = await supabase
					.from("user_profiles")
					.select("id")
					.eq("id", user.id)
					.single();

				if (!existingProfile) {
					// Создаем профиль пользователя
					const { error: profileError } = await supabase
						.from("user_profiles")
						.insert({
							id: user.id,
							username:
								user.user_metadata?.user_name ||
								user.email?.split("@")[0] ||
								"user",
							display_name:
								user.user_metadata?.full_name ||
								user.user_metadata?.user_name ||
								null,
							role: "user",
						});

					if (profileError) {
						console.error("Error creating user profile:", profileError);
					}
				}
			}

			return NextResponse.redirect(process.env.NEXT_PUBLIC_SITE_URL!);
		}
	}

	// Если произошла ошибка или нет кода, перенаправляем на страницу логина
	return NextResponse.redirect(
		`${origin}/auth/login?error=auth_callback_error`,
	);
}
