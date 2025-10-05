/**
 * Исправленный скрипт для отладки механизма загрузки одиночного файла в bucket книг
 * и установки связи с ним в таблице книг.
 * 
 * Требования:
 * 1. Типы файлов могут быть только fb2 и zip
 * 2. Имя файла должно иметь вид <MessageID>.zip
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';
import { uploadFileToStorage } from '../lib/supabase';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function debugSingleFileUploadCorrect() {
  console.log('🔍 Отладка механизма загрузки одиночного файла...\n');
  
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
    console.log('🔧 Инициализация клиента Telegram...');
    const session = new StringSession(sessionString);
    telegramClient = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await telegramClient.connect();
    console.log('✅ Клиент Telegram подключен\n');
    
    // Создаем клиента Supabase
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Доступ к каналу файлов с использованием правильного метода
    const channelId = 1515159552; // ID для "Архив для фантастики"
    console.log(`🆔 Доступ к каналу: Архив для фантастики (ID: ${channelId})\n`);
    
    // Получение сущности канала с использованием PeerChannel
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`✅ Сущность канала получена: ${(channelEntity as any).title}\n`);
    
    // Получение сообщений из канала
    console.log('📥 Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 5 });
    console.log(`📊 Получено ${messages.length} сообщений\n`);
    
    // Поиск первого сообщения с файлом
    let fileMessage = null;
    for (const msg of messages) {
      if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
        fileMessage = msg;
        break;
      }
    }
    
    if (!fileMessage) {
      console.log('❌ В первых 5 сообщениях не найдено файлов');
      return;
    }
    
    console.log(`✅ Найдено сообщение с файлом: ID ${fileMessage.id}\n`);
    
    // Извлечение информации о файле
    const document = (fileMessage as any).media.document;
    const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
    const originalFilename = filenameAttr?.fileName || `book_${fileMessage.id}`;
    const fileExtension = path.extname(originalFilename).toLowerCase();
    
    console.log(`📄 Оригинальное имя файла: ${originalFilename}`);
    console.log(`📄 Расширение файла: ${fileExtension}`);
    
    // Проверка допустимых типов файлов
    const allowedExtensions = ['.fb2', '.zip'];
    if (!allowedExtensions.includes(fileExtension)) {
      console.log(`⚠️  Тип файла ${fileExtension} не разрешен. Допустимые типы: ${allowedExtensions.join(', ')}`);
      return;
    }
    console.log(`✅ Тип файла разрешен: ${fileExtension}\n`);
    
    // Скачивание файла
    console.log('📥 Скачивание файла из Telegram...');
    const fileBuffer = await telegramClient.downloadMedia(fileMessage, {});
    
    if (!fileBuffer) {
      console.log('❌ Ошибка при скачивании файла');
      return;
    }
    
    // Преобразование в Buffer если это необходимо
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as unknown as Uint8Array);
    
    console.log(`✅ Файл успешно скачан (${buffer.length} байт)\n`);
    
    // Формирование имени файла в формате <MessageID>.zip (или .fb2)
    const storageFilename = `${fileMessage.id}${fileExtension}`;
    console.log(`💾 Имя файла для хранения: ${storageFilename}`);
    
    // Определение MIME-типа
    const mimeTypes: Record<string, string> = {
      '.fb2': 'application/fb2+xml',
      '.zip': 'application/zip',
    };
    const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
    console.log(`📄 MIME-тип: ${mimeType}\n`);
    
    // Загрузка файла в Supabase Storage (bucket 'books')
    console.log('☁️  Загрузка файла в Supabase Storage...');
    try {
      const uploadResult = await uploadFileToStorage('books', storageFilename, buffer, mimeType);
      console.log(`✅ Файл успешно загружен в Storage:`, uploadResult);
    } catch (uploadError) {
      console.error('❌ Ошибка при загрузке файла в Storage:', uploadError);
      return;
    }
    
    // Формирование URL файла
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/books/${encodeURIComponent(storageFilename)}`;
    console.log(`🔗 URL файла: ${fileUrl}\n`);
    
    // Проверка файла в Storage
    console.log('🔍 Проверка файла в Storage...');
    try {
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('books')
        .download(storageFilename);
      
      if (fileError) {
        console.error('❌ Ошибка при проверке файла в Storage:', fileError);
      } else if (fileData) {
        console.log(`✅ Файл успешно загружен в Storage (${fileData.size} байт)`);
        console.log(`✅ Имя файла в Storage: ${storageFilename}`);
      }
    } catch (downloadError) {
      console.error('❌ Ошибка при проверке файла в Storage:', downloadError);
    }
    
    console.log('\n✅ Отладка механизма загрузки одиночного файла завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка во время отладки:', error);
  } finally {
    // Отключение клиента
    if (telegramClient) {
      try {
        await telegramClient.disconnect();
        console.log('\n🧹 Telegram клиент отключен');
      } catch (disconnectError) {
        console.error('⚠️ Ошибка при отключении клиента:', disconnectError);
      }
    }
    
    // Принудительное завершение скрипта из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
debugSingleFileUploadCorrect().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});