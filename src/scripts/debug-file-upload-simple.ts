/**
 * Упрощенный скрипт для отладки механизма загрузки одиночного файла
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

async function debugFileUploadSimple() {
  console.log('🔍 Упрощенная отладка механизма загрузки файла...\n');
  
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
    
    // Доступ к каналу файлов
    const channelId = 1515159552; // ID для "Архив для фантастики"
    console.log(`🆔 Доступ к каналу: Архив для фантастики (ID: ${channelId})\n`);
    
    // Получение сущности канала
    const channelEntity = await telegramClient.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
    console.log(`✅ Сущность канала получена: ${(channelEntity as any).title}\n`);
    
    // Получение сообщений из канала
    console.log('📥 Получение файлов из канала...');
    const messages = await telegramClient.getMessages(channelEntity, { limit: 3 });
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
      console.log('❌ В первых 3 сообщениях не найдено файлов');
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
    
    // Создание тестового буфера вместо скачивания файла
    console.log('🧪 Создание тестового буфера вместо скачивания файла...');
    const testBuffer = Buffer.from('Тестовый контент файла для отладки механизма загрузки', 'utf-8');
    console.log(`✅ Тестовый буфер создан (${testBuffer.length} байт)\n`);
    
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
    
    // Проверка доступа к Supabase Admin
    console.log('🔍 Проверка доступа к Supabase Admin...');
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.log('❌ Не удалось получить доступ к Supabase Admin');
      return;
    }
    console.log('✅ Доступ к Supabase Admin получен\n');
    
    // Загрузка файла в Supabase Storage (bucket 'books')
    console.log('☁️  Загрузка файла в Supabase Storage...');
    try {
      const uploadResult = await uploadFileToStorage('books', storageFilename, testBuffer, mimeType);
      console.log(`✅ Файл успешно загружен в Storage:`, uploadResult);
    } catch (uploadError) {
      console.error('❌ Ошибка при загрузке файла в Storage:', uploadError);
      return;
    }
    
    // Проверка файла в Storage
    console.log('🔍 Проверка файла в Storage...');
    try {
      const { data: fileData, error: fileError } = await admin
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
    
    console.log('\n✅ Упрощенная отладка механизма загрузки файла завершена успешно!');
    
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
    console.log('\n🛑 Принудительное завершение скрипта...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запуск скрипта
debugFileUploadSimple().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});