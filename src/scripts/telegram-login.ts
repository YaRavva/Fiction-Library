import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function run() {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiIdRaw || !apiHash) {
    console.error('Ошибка: TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env');
    process.exit(1);
  }

  const apiId = parseInt(apiIdRaw, 10);
  const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });


  const phoneEnv = process.env.TELEGRAM_PHONE;
  const codeEnv = process.env.TELEGRAM_CODE;
  const twofaEnv = process.env.TELEGRAM_2FA || '';

  // Non-interactive mode (env-provided phone+code)
  if (phoneEnv && codeEnv) {
    try {
      await client.start({
        phoneNumber: async () => phoneEnv,
        phoneCode: async () => codeEnv,
        password: async () => twofaEnv,
        onError: (err: any) => console.error('Ошибка при авторизации:', err),
      });

      const sessionString = client.session.save();
      console.log('\n✅ Успешно авторизованы (неинтерактивно).');
      console.log('Добавьте в ваш .env:');
      console.log(`TELEGRAM_SESSION=${sessionString}`);
      process.exit(0);
    } catch (err) {
      console.error('Не удалось выполнить неинтерактивный вход:', err);
      process.exit(1);
    }
  }

  // Interactive mode if running in a real terminal
  if (process.stdin.isTTY && process.stdout.isTTY) {
    try {
      const phone = await question('Введите номер телефона (в международном формате, напр. +79161234567): ');
      await client.start({
        phoneNumber: async () => phone.trim(),
        phoneCode: async () => await question('Введите код из Telegram: '),
        password: async () => await question('Если включена 2FA, введите пароль (иначе нажмите Enter): '),
        onError: (err: any) => console.error('Ошибка при авторизации:', err),
      });

      const sessionString = client.session.save();
      console.log('\n✅ Успешно авторизованы (интерактивно).');
      console.log('Добавьте в ваш .env:');
      console.log(`TELEGRAM_SESSION=${sessionString}`);
      process.exit(0);
    } catch (err) {
      console.error('Не удалось выполнить интерактивный вход:', err);
      process.exit(1);
    }
  }

  console.log('Для интерактивного получения сессии выполните команду локально:');
  console.log('pnpm tsx src/scripts/telegram-login.ts');
  console.log('\nИли установите в .env переменные TELEGRAM_PHONE и TELEGRAM_CODE, чтобы выполнить вход неинтерактивно.');
  process.exit(0);
}

run();
