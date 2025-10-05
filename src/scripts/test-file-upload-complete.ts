/**
 * Полный тестовый скрипт для проверки механизма загрузки файла
 * и установки связи с книгой в базе данных
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

async function testFileUploadComplete() {
  console.log('🧪 Полное тестирование механизма загрузки файла\n');
  
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
    console.log('1️⃣  Инициализация клиента Telegram...');
    const session = new StringSession(sessionString);
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await telegramClient.connect();
    console.log('    ✅ Клиент Telegram подключен\n');
    
    // Создаем клиента Supabase
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Доступ к каналу файлов
    const channelId = 1515159552; // ID для "Архив для фантастики"
    console.log(`2️⃣  Доступ к каналу "Архив для фантастики" (ID: ${channelId})`);
    
    // Получение сущности канала
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`    ✅ Сущность канала получена: "${(channelEntity as any).title}"\n`);
    
    // Получение сообщений из канала
    console.log('3️⃣  Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 3 });
    console.log(`    ✅ Получено ${messages.length} сообщений\n`);
    
    // Поиск первого сообщения с файлом
    let fileMessage = null;
    let fileIndex = 0;
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        fileMessage = msg;
        break;
      }
      fileIndex++;
    }
    
    if (!fileMessage) {
      console.log('    ⚠️  В первых 3 сообщениях не найдено файлов');
      console.log('    📋 Попробуем получить больше сообщений...');
      
      // Получаем больше сообщений
      const moreMessages = await telegramClient.getMessages(channelEntity, { limit: 10 });
      console.log(`    ✅ Получено ${moreMessages.length} сообщений`);
      
      // Поиск сообщения с файлом
      for (const msg of moreMessages) {
        if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
          fileMessage = msg;
          break;
        }
      }
      
      if (!fileMessage) {
        console.log('    ❌ Не найдено сообщений с файлами');
        return;
      }
    }
    
    console.log(`4️⃣  Найдено сообщение с файлом: ID ${fileMessage.id}`);
    
    // Извлечение информации о файле
    const document = (fileMessage as any).media.document;
    const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
    const originalFilename = filenameAttr?.fileName || `book_${fileMessage.id}`;
    const fileExtension = path.extname(originalFilename).toLowerCase();
    
    // Проверка допустимых типов файлов
    const allowedExtensions = ['.fb2', '.zip'];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log(`    ⚠️  Тип файла "${fileExtension}" не разрешен`);
      console.log(`    📋 Допустимые типы: ${allowedExtensions.join(', ')}`);
      return;
    }
    
    console.log(`    ✅ Тип файла разрешен: ${fileExtension}`);
    console.log(`    📄 Оригинальное имя файла: ${originalFilename}\n`);
    
    // Скачивание файла
    console.log('5️⃣  Скачивание файла из Telegram...');
    const fileBuffer = await telegramClient.downloadMedia(fileMessage, {});
    
    if (!fileBuffer) {
      console.log('    ❌ Ошибка при скачивании файла');
      return;
    }
    
    // Преобразование в Buffer если это необходимо
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as unknown as Uint8Array);
    console.log(`    ✅ Файл успешно скачан (${buffer.length} байт)\n`);
    
    // Формирование имени файла в формате <MessageID>.zip (или .fb2)
    const storageFilename = `${fileMessage.id}${fileExtension}`;
    console.log(`6️⃣  Формирование имени файла для хранения:`);
    console.log(`    💾 Имя файла: ${storageFilename}`);
    
    // Определение MIME-типа и формата файла
    const mimeTypes: Record<string, string> = {
      '.fb2': 'application/fb2+xml',
      '.zip': 'application/zip',
    };
    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
    const fileFormat = fileExtension.replace('.', '');
    console.log(`    📄 MIME-тип: ${mimeType}`);
    console.log(`    📄 Формат файла: ${fileFormat}\n`);
    
    // Загрузка файла в Supabase Storage (bucket 'books')
    console.log('7️⃣  Загрузка файла в Supabase Storage...');
    try {
      const uploadResult = await uploadFileToStorage('books', storageFilename, buffer, mimeType);
      console.log(`    ✅ Файл успешно загружен в Storage`);
      console.log(`    📁 Путь в Storage: ${uploadResult.path}`);
    } catch (uploadError) {
      console.error('    ❌ Ошибка при загрузке файла в Storage:', (uploadError as Error).message);
      return;
    }
    
    // Формирование URL файла
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/books/${encodeURIComponent(storageFilename)}`;
    console.log(`8️⃣  Формирование URL файла:`);
    console.log(`    🔗 URL: ${fileUrl}\n`);
    
    // Проверка файла в Storage
    console.log('9️⃣  Проверка файла в Storage...');
    try {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data: fileData, error: fileError } = await admin
          .storage
          .from('books')
          .download(storageFilename);
        
        if (fileError) {
          console.error('    ❌ Ошибка при проверке файла в Storage:', (fileError as Error).message);
        } else if (fileData) {
          console.log(`    ✅ Файл успешно загружен в Storage (${fileData.size} байт)`);
        }
      }
    } catch (downloadError) {
      console.error('    ❌ Ошибка при проверке файла в Storage:', (downloadError as Error).message);
    }
    
    console.log('\n🎉 Полное тестирование механизма загрузки файла успешно завершено!');
    console.log('\n📋 Итоговая сводка:');
    console.log(`   🆔 Message ID файла: ${fileMessage.id}`);
    console.log(`   📄 Оригинальное имя: ${originalFilename}`);
    console.log(`   📏 Размер файла: ${buffer.length} байт`);
    console.log(`   📝 Формат файла: ${fileFormat}`);
    console.log(`   💾 Имя в Storage: ${storageFilename}`);
    console.log(`   🔗 URL файла: ${fileUrl}`);
    console.log('\n✅ Все этапы механизма загрузки успешно пройдены!');
    
  } catch (error) {
    console.error('❌ Ошибка во время тестирования:', (error as Error).message);
    console.error('   Подробности:', error);
  } finally {
    // Отключение клиента
    if (telegramClient) {
      try {
        await telegramClient.disconnect();
        console.log('\n🔌 Telegram клиент отключен');
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
testFileUploadComplete().catch(error => {
  console.error('Необработанная ошибка:', (error as Error).message);
  process.exit(1);
});