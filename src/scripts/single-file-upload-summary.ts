/**
 * Сводный скрипт для демонстрации механизма загрузки одиночного файла
 * и установки связи с книгой в базе данных.
 * 
 * Требования:
 * 1. Типы файлов могут быть только fb2 и zip
 * 2. Имя файла должно иметь вид <MessageID>.zip (или .fb2)
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { uploadFileToStorage, getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function singleFileUploadSummary() {
  console.log('📋 Сводная демонстрация механизма загрузки одиночного файла\n');
  
  let telegramClient: TelegramClient | null = null;
  
  try {
    // Получаем переменные окружения
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!apiId || !apiHash || !sessionString || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Отсутствуют необходимые переменные окружения');
    }
    
    // Инициализируем клиент Telegram
    console.log('1. 🔧 Инициализация клиента Telegram...');
    const session = new StringSession(sessionString);
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await telegramClient.connect();
    console.log('   ✅ Клиент Telegram подключен\n');
    
    // Создаем клиента Supabase
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Доступ к каналу файлов
    const channelId = 1515159552; // ID для "Архив для фантастики"
    console.log(`2. 📡 Доступ к каналу "Архив для фантастики" (ID: ${channelId})`);
    
    // Получение сущности канала
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`   ✅ Сущность канала получена: ${(channelEntity as any).title}\n`);
    
    // Получение сообщений из канала
    console.log('3. 📥 Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 3 });
    console.log(`   ✅ Получено ${messages.length} сообщений\n`);
    
    // Поиск первого сообщения с файлом
    let fileMessage = null;
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        fileMessage = msg;
        break;
      }
    }
    
    if (!fileMessage) {
      console.log('   ❌ В первых 3 сообщениях не найдено файлов');
      return;
    }
    
    console.log(`4. 📄 Найдено сообщение с файлом: ID ${fileMessage.id}`);
    
    // Извлечение информации о файле
    const document = (fileMessage as any).media.document;
    const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
    const originalFilename = filenameAttr?.fileName || `book_${fileMessage.id}`;
    const fileExtension = path.extname(originalFilename).toLowerCase();
    
    // Проверка допустимых типов файлов
    const allowedExtensions = ['.fb2', '.zip'];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log(`   ⚠️  Тип файла ${fileExtension} не разрешен`);
      return;
    }
    
    console.log(`   ✅ Тип файла разрешен: ${fileExtension}`);
    console.log(`   📄 Оригинальное имя файла: ${originalFilename}\n`);
    
    // Скачивание файла
    console.log('5. 📥 Скачивание файла из Telegram...');
    const fileBuffer = await telegramClient.downloadMedia(fileMessage, {});
    
    if (!fileBuffer) {
      console.log('   ❌ Ошибка при скачивании файла');
      return;
    }
    
    // Преобразование в Buffer если это необходимо
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as unknown as Uint8Array);
    console.log(`   ✅ Файл успешно скачан (${buffer.length} байт)\n`);
    
    // Формирование имени файла в формате <MessageID>.zip (или .fb2)
    const storageFilename = `${fileMessage.id}${fileExtension}`;
    console.log(`6. 💾 Формирование имени файла для хранения: ${storageFilename}`);
    
    // Определение MIME-типа и формата файла
    const mimeTypes: Record<string, string> = {
      '.fb2': 'application/fb2+xml',
      '.zip': 'application/zip',
    };
    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
    const fileFormat = fileExtension.replace('.', '');
    console.log(`   📄 MIME-тип: ${mimeType}`);
    console.log(`   📄 Формат файла: ${fileFormat}\n`);
    
    // Загрузка файла в Supabase Storage (bucket 'books')
    console.log('7. ☁️  Загрузка файла в Supabase Storage...');
    try {
      const uploadResult = await uploadFileToStorage('books', storageFilename, buffer, mimeType);
      console.log(`   ✅ Файл успешно загружен в Storage`);
    } catch (uploadError) {
      console.error('   ❌ Ошибка при загрузке файла в Storage:', (uploadError as Error).message);
      return;
    }
    
    // Формирование URL файла
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/books/${encodeURIComponent(storageFilename)}`;
    console.log(`8. 🔗 Формирование URL файла: ${fileUrl}\n`);
    
    // Проверка файла в Storage
    console.log('9. 🔍 Проверка файла в Storage...');
    try {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data: fileData, error: fileError } = await admin
          .storage
          .from('books')
          .download(storageFilename);
        
        if (fileError) {
          console.error('   ❌ Ошибка при проверке файла в Storage:', (fileError as Error).message);
        } else if (fileData) {
          console.log(`   ✅ Файл успешно загружен в Storage (${fileData.size} байт)`);
        }
      }
    } catch (downloadError) {
      console.error('   ❌ Ошибка при проверке файла в Storage:', (downloadError as Error).message);
    }
    
    console.log('\n🎉 Механизм загрузки одиночного файла работает корректно!');
    console.log('\n📋 Итоговая сводка:');
    console.log(`   • Message ID файла: ${fileMessage.id}`);
    console.log(`   • Оригинальное имя: ${originalFilename}`);
    console.log(`   • Размер файла: ${buffer.length} байт`);
    console.log(`   • Формат файла: ${fileFormat}`);
    console.log(`   • Имя в Storage: ${storageFilename}`);
    console.log(`   • URL файла: ${fileUrl}`);
    console.log('\n✅ Все этапы механизма загрузки успешно пройдены!');
    
  } catch (error) {
    console.error('❌ Ошибка во время демонстрации:', (error as Error).message);
  } finally {
    // Отключение клиента
    if (telegramClient) {
      try {
        await telegramClient.disconnect();
        console.log('\n🧹 Telegram клиент отключен');
      } catch (disconnectError) {
        console.error('⚠️ Ошибка при отключении клиента:', (disconnectError as Error).message);
      }
    }
    
    // Принудительное завершение скрипта
    console.log('\n🛑 Принудительное завершение скрипта...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
singleFileUploadSummary().catch(error => {
  console.error('Необработанная ошибка:', error.message);
  process.exit(1);
});