import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NextResponse } from "next/server";

// In-memory store for pending logins
const pendingLogins = new Map<
	string,
	{
		client: TelegramClient;
		phoneCodeHash: string;
	}
>();

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
		const { step, phone, code, password } = await request.json();
		const { apiId, apiHash } = getApiCredentials();

		// Step 1: Send code
		if (step === "send_code") {
			if (!phone) {
				return NextResponse.json({ error: "Номер телефона обязателен" }, { status: 400 });
			}

			const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
				connectionRetries: 1,
			});
			await client.connect();

			const result = await client.invoke(
				new Api.auth.SendCode({
					phoneNumber: phone,
					apiId,
					apiHash,
					settings: new Api.CodeSettings(),
				}),
			);

			pendingLogins.set(phone, {
				client,
				phoneCodeHash: result.phoneCodeHash,
			});

			return NextResponse.json({ step: "code_sent" });
		}

		// Step 2: Submit code
		if (step === "submit_code") {
			if (!phone || !code) {
				return NextResponse.json({ error: "Телефон и код обязательны" }, { status: 400 });
			}

			const pending = pendingLogins.get(phone);
			if (!pending) {
				return NextResponse.json({ error: "Сессия истекла. Начните заново." }, { status: 400 });
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

				const session = client.session.save();
				await client.disconnect();
				pendingLogins.delete(phone);

				return NextResponse.json({ step: "done", session });
			} catch (err: any) {
				if (
					err?.errorMessage === "SESSION_PASSWORD_NEEDED" ||
					err?.message?.includes("password")
				) {
					return NextResponse.json({ step: "password_needed" });
				}
				throw err;
			}
		}

		// Step 3: Submit 2FA password
		if (step === "submit_password") {
			if (!phone || !password) {
				return NextResponse.json({ error: "Телефон и пароль обязательны" }, { status: 400 });
			}

			const pending = pendingLogins.get(phone);
			if (!pending) {
				return NextResponse.json({ error: "Сессия истекла. Начните заново." }, { status: 400 });
			}

			const { client } = pending;

			const passwordInfo = await client.invoke(new Api.account.GetPassword());

			const checkPassword = async (pw: string) => {
				if (passwordInfo.currentAlgo instanceof Api.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512Iter100000SHA256PrkHash) {
					const { A, M1 } = await client.passwordComputeCheck({
						password: pw,
						salt1: passwordInfo.salt1,
						salt2: passwordInfo.salt2,
						srpId: passwordInfo.srpId,
						algo: passwordInfo.currentAlgo,
					});
					return new Api.InputCheckPasswordSRP({
						srpId: passwordInfo.srpId,
						A,
						M1,
					});
				}
				throw new Error("Unsupported password algorithm");
			};

			const inputPassword = await checkPassword(password);

			await client.invoke(
				new Api.auth.CheckPassword({ password: inputPassword }),
			);

			const session = client.session.save();
			await client.disconnect();
			pendingLogins.delete(phone);

			return NextResponse.json({ step: "done", session });
		}

		return NextResponse.json({ error: "Неизвестный шаг" }, { status: 400 });
	} catch (error: any) {
		console.error("Telegram relogin error:", error);
		return NextResponse.json(
			{ error: error.message || "Ошибка авторизации" },
			{ status: 500 },
		);
	}
}
