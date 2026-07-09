import { NextResponse } from "next/server";
import { Api, TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password";
import { StringSession } from "telegram/sessions";

function getApiCredentials() {
	const apiId = process.env.TELEGRAM_API_ID;
	const apiHash = process.env.TELEGRAM_API_HASH;
	if (!apiId || !apiHash) {
		throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set");
	}
	return { apiId: parseInt(apiId, 10), apiHash };
}

// In-memory store for pending logins (phone -> { phoneCodeHash, client })
const pendingLogins = new Map<
	string,
	{ phoneCodeHash: string; client: TelegramClient; ts: number }
>();
const PENDING_TTL = 3 * 60 * 1000;

function cleanupPending() {
	const now = Date.now();
	for (const [key, val] of pendingLogins) {
		if (now - val.ts > PENDING_TTL) {
			val.client.disconnect().catch(() => {});
			pendingLogins.delete(key);
		}
	}
}

export async function POST(request: Request) {
	try {
		const { action, phone, code, password } = await request.json();
		const { apiId, apiHash } = getApiCredentials();

		cleanupPending();

		// --- Step 1: Send verification code ---
		if (action === "send_code") {
			if (!phone) {
				return NextResponse.json(
					{ error: "Телефон обязателен" },
					{ status: 400 },
				);
			}

			// Disconnect old client if exists
			const old = pendingLogins.get(phone);
			if (old) {
				old.client.disconnect().catch(() => {});
				pendingLogins.delete(phone);
			}

			const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
				connectionRetries: 1,
			});
			await client.connect();

			try {
				const result = await client.invoke(
					new Api.auth.SendCode({
						phoneNumber: phone,
						apiId,
						apiHash,
						settings: new Api.CodeSettings({}),
					}),
				);

				pendingLogins.set(phone, {
					phoneCodeHash: (result as { phoneCodeHash: string }).phoneCodeHash,
					client,
					ts: Date.now(),
				});

				return NextResponse.json({ ok: true });
			} catch (err: unknown) {
				await client.disconnect();
				return NextResponse.json(
					{ error: err instanceof Error ? err.message : "Ошибка отправки кода" },
					{ status: 400 },
				);
			}
		}

		// --- Step 2: Sign in with code ---
		if (action === "sign_in") {
			if (!phone || !code) {
				return NextResponse.json(
					{ error: "Телефон и код обязательны" },
					{ status: 400 },
				);
			}

			const pending = pendingLogins.get(phone);
			if (!pending) {
				return NextResponse.json(
					{ error: "Сессия истекла. Запросите код заново." },
					{ status: 400 },
				);
			}

			const { client, phoneCodeHash } = pending;

			try {
				await client.invoke(
					new Api.auth.SignIn({
						phoneNumber: phone,
						phoneCodeHash,
						phoneCode: code,
					}),
				);

				pendingLogins.delete(phone);
				const session = client.session.save();
				await client.disconnect();
				return NextResponse.json({ session });
			} catch (signInError: unknown) {
				const msg =
					(signInError as { errorMessage?: string })?.errorMessage ||
					(signInError instanceof Error ? signInError.message : undefined) ||
					String(signInError);

				if (msg === "SESSION_PASSWORD_NEEDED" || msg.includes("password")) {
					if (!password) {
						return NextResponse.json({ step: "password_needed" });
					}

					try {
						const passwordInfo = await client.invoke(
							new Api.account.GetPassword(),
						);

						const inputPassword = await computeCheck(passwordInfo, password);

						await client.invoke(
							new Api.auth.CheckPassword({ password: inputPassword }),
						);

						pendingLogins.delete(phone);
						const session = client.session.save();
						await client.disconnect();
						return NextResponse.json({ session });
					} catch (pwError: unknown) {
						await client.disconnect();
						pendingLogins.delete(phone);
						return NextResponse.json(
							{ error: `Ошибка пароля: ${pwError instanceof Error ? pwError.message : String(pwError)}` },
							{ status: 400 },
						);
					}
				}

				await client.disconnect();
				pendingLogins.delete(phone);
				return NextResponse.json(
					{ error: `Ошибка входа: ${msg}` },
					{ status: 400 },
				);
			}
		}

		return NextResponse.json(
			{ error: "Неизвестное действие" },
			{ status: 400 },
		);
	} catch (error: unknown) {
		console.error("Telegram relogin error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Ошибка авторизации" },
			{ status: 500 },
		);
	}
}
