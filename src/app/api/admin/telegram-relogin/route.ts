import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NextResponse } from "next/server";

function getApiCredentials() {
	const apiId = process.env.TELEGRAM_API_ID;
	const apiHash = process.env.TELEGRAM_API_HASH;
	if (!apiId || !apiHash) {
		throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set");
	}
	return { apiId: parseInt(apiId, 10), apiHash };
}

// In-memory store for phoneCodeHash (expires after 5 min)
const codeHashStore = new Map<string, { hash: string; ts: number }>();
const CODE_HASH_TTL = 5 * 60 * 1000;

function cleanupStore() {
	const now = Date.now();
	for (const [key, val] of codeHashStore) {
		if (now - val.ts > CODE_HASH_TTL) codeHashStore.delete(key);
	}
}

export async function POST(request: Request) {
	try {
		const { action, phone, code, password } = await request.json();
		const { apiId, apiHash } = getApiCredentials();

		cleanupStore();

		// --- Step 1: Send verification code ---
		if (action === "send_code") {
			if (!phone) {
				return NextResponse.json(
					{ error: "Телефон обязателен" },
					{ status: 400 },
				);
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
						settings: new Api.CodeSettings(),
					}),
				);

				codeHashStore.set(phone, {
					hash: result.phoneCodeHash,
					ts: Date.now(),
				});

				await client.disconnect();
				return NextResponse.json({ ok: true });
			} catch (err: any) {
				await client.disconnect();
				return NextResponse.json(
					{ error: err.message || "Ошибка отправки кода" },
					{ status: 400 },
				);
			}
		}

		// --- Step 2: Sign in with code (and optional 2FA password) ---
		if (action === "sign_in") {
			if (!phone || !code) {
				return NextResponse.json(
					{ error: "Телефон и код обязательны" },
					{ status: 400 },
				);
			}

			const stored = codeHashStore.get(phone);
			if (!stored) {
				return NextResponse.json(
					{ error: "Код не запрашивался или истёк. Запросите заново." },
					{ status: 400 },
				);
			}

			const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
				connectionRetries: 1,
			});
			await client.connect();

			try {
				await client.invoke(
					new Api.auth.SignIn({
						phoneNumber: phone,
						phoneCodeHash: stored.hash,
						phoneCode: code,
					}),
				);

				codeHashStore.delete(phone);
				const session = client.session.save();
				await client.disconnect();
				return NextResponse.json({ session });
			} catch (signInError: any) {
				if (
					signInError?.errorMessage === "SESSION_PASSWORD_NEEDED" ||
					signInError?.message?.includes("password")
				) {
					if (!password) {
						await client.disconnect();
						return NextResponse.json({ step: "password_needed" });
					}

					try {
						const passwordInfo = await client.invoke(
							new Api.account.GetPassword(),
						);

						// @ts-ignore
						const inputPassword = await client._client.passwordComputeCheck(
							password,
							passwordInfo,
						);

						await client.invoke(
							new Api.auth.CheckPassword({ password: inputPassword }),
						);

						codeHashStore.delete(phone);
						const session = client.session.save();
						await client.disconnect();
						return NextResponse.json({ session });
					} catch (pwError: any) {
						await client.disconnect();
						return NextResponse.json(
							{ error: `Ошибка пароля: ${pwError.message}` },
							{ status: 400 },
						);
					}
				}

				await client.disconnect();
				throw signInError;
			}
		}

		return NextResponse.json(
			{ error: "Неизвестное действие" },
			{ status: 400 },
		);
	} catch (error: any) {
		console.error("Telegram relogin error:", error);
		return NextResponse.json(
			{ error: error.message || "Ошибка авторизации" },
			{ status: 500 },
		);
	}
}
