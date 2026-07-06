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
		const { phone, code, password } = await request.json();
		const { apiId, apiHash } = getApiCredentials();

		if (!phone || !code) {
			return NextResponse.json(
				{ error: "Телефон и код обязательны" },
				{ status: 400 },
			);
		}

		// Create client and do the full login in one request
		const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
			connectionRetries: 1,
		});

		await client.connect();

		// Send code request
		const sendCodeResult = await client.invoke(
			new Api.auth.SendCode({
				phoneNumber: phone,
				apiId,
				apiHash,
				settings: new Api.CodeSettings(),
			}),
		);

		// Sign in with code
		try {
			await client.invoke(
				new Api.auth.SignIn({
					phoneNumber: phone,
					phoneCodeHash: sendCodeResult.phoneCodeHash,
					phoneCode: code,
				}),
			);

			// Login succeeded
			const session = client.session.save();
			await client.disconnect();
			return NextResponse.json({ session });
		} catch (signInError: any) {
			// Check if 2FA is needed
			if (
				signInError?.errorMessage === "SESSION_PASSWORD_NEEDED" ||
				signInError?.message?.includes("password") ||
				signInError?.errorMessage === "PASSWORD_HASH_INVALID"
			) {
				if (!password) {
					await client.disconnect();
					return NextResponse.json({ step: "password_needed" });
				}

				// Handle 2FA password
				try {
					const passwordInfo = await client.invoke(
						new Api.account.GetPassword(),
					);

					// Use GramJS's internal password check
					// @ts-ignore - accessing internal method
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
						{ error: `Ошибка пароля: ${pwError.message}` },
						{ status: 400 },
					);
				}
			}

			await client.disconnect();
			throw signInError;
		}
	} catch (error: any) {
		console.error("Telegram relogin error:", error);
		return NextResponse.json(
			{ error: error.message || "Ошибка авторизации" },
			{ status: 500 },
		);
	}
}
