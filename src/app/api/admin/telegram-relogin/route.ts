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

export async function POST(request: Request) {
	try {
		const { action, phone, phoneCodeHash, code, password } =
			await request.json();
		const { apiId, apiHash } = getApiCredentials();

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

				await client.disconnect();
				return NextResponse.json({
					ok: true,
					phoneCodeHash: result.phoneCodeHash,
				});
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
			if (!phone || !code || !phoneCodeHash) {
				return NextResponse.json(
					{ error: "Телефон, код и phoneCodeHash обязательны" },
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
						phoneCodeHash,
						phoneCode: code,
					}),
				);

				const session = client.session.save();
				await client.disconnect();
				return NextResponse.json({ session });
			} catch (signInError: any) {
				const msg =
					signInError?.errorMessage || signInError?.message || String(signInError);

				// 2FA required
				if (
					msg === "SESSION_PASSWORD_NEEDED" ||
					msg.includes("password")
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

						const session = client.session.save();
						await client.disconnect();
						return NextResponse.json({ session });
					} catch (pwError: any) {
						await client.disconnect();
						return NextResponse.json(
							{ error: `Ошибка пароля: ${pwError.message || pwError}` },
							{ status: 400 },
						);
					}
				}

				// Code expired or invalid
				await client.disconnect();
				return NextResponse.json({ error: `Ошибка входа: ${msg}` }, { status: 400 });
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
