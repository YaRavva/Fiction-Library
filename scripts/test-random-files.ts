// Скрипт для получения и анализа случайных файлов из Telegram
// Использует TelegramService напрямую

// Загружаем переменные окружения из .env файла
import * as dotenv from 'dotenv';
dotenv.config();

import { TelegramService } from '../src/lib/telegram/client';
import path from 'path';

// Функция для нормализации строки
const normalizeString = (str: string): string => {
  try {
    return str.normalize('NFC').toLowerCase();
  } catch (error) {
    console.error('Ошибка нормализации строки:', str);
    return str.toLowerCase();
  }
};

// Функция для разбиения строки на слова
const extractWords = (str: string): string[] => {
  // Разбиваем по различным разделителям: пробелы, дефисы, скобки, точки и т.д.
  return str
    .split(/[\s\-_\(\)\[\]\{\}\/\\\.]+/)
    .filter(word => word.length > 1) // Игнорируем слова короче 2 символов
    .map(word => word.trim())
    .filter(word => word.length > 0);
};

// Функция для извлечения оригинального имени файла из сообщения Telegram
function getOriginalFilename(message: any): string {
  let originalFilename = `file_${message.id}`;

  // Попробуем получить имя файла из разных источников
  if (message.document && message.document.attributes) {
    const attributes = message.document.attributes;
    const attrFileName = attributes.find((attr: any) => {
      return attr.className === 'DocumentAttributeFilename';
    });
    if (attrFileName && attrFileName.fileName) {
      originalFilename = attrFileName.fileName;
    }
  } else if (message.document && message.document.fileName) {
    // Альтернативный способ получения имени файла
    originalFilename = message.document.fileName;
  } else if (message.fileName) {
    // Еще один способ получения имени файла
    originalFilename = message.fileName;
  } else if (message.media) {
    // Проверяем в media
    const media = message.media.document || message.media.photo;
    if (media && media.fileName) {
      originalFilename = media.fileName;
    } else if (media && media.filename) {
      originalFilename = media.filename;
    }
  }

  return originalFilename;
}

// Функция для получения файлов напрямую из Telegram
async function fetchTelegramFiles() {
  try {
    console.log('🔍 Получение списка файлов из Telegram...');
    
    // Создаем экземпляр TelegramService
    const telegramClient = await TelegramService.getInstance();
    
    console.log('📡 Подключение к каналу с файлами...');
    // Получаем канал с файлами (ID: 1515159552)
    const fileChannel = await telegramClient.getFilesChannel();
    
    console.log('📥 Загрузка сообщений из канала (ограничено 300 сообщениями для тестирования)...');
    // Получаем все сообщения с файлами (ограничим до 300 для тестирования)
    const messages = await telegramClient.getAllMessages(fileChannel, 300);
    
    console.log(`📁 Получено ${messages.length} сообщений`);
    
    // Фильтруем только сообщения с файлами
    const files = messages
      .filter((msg: any) => msg.media && (msg.media.document || msg.media.photo))
      .map((msg: any) => {
        // Используем правильную логику для извлечения имени файла
        const rawFileName = getOriginalFilename(msg);
        
        // Нормализуем имя файла в NFC форму для консистентности
        const normalizedFileName = rawFileName.normalize('NFC');

        // Получаем размер и MIME тип
        const media = msg.media.document || msg.media.photo;
        const fileSize = media?.size || 0;
        const mimeType = media?.mimeType || media?.mime_type || 'application/octet-stream';

        return {
          message_id: msg.id,
          file_name: normalizedFileName,
          file_size: fileSize,
          mime_type: mimeType,
          caption: msg.message || '',
          date: msg.date || Date.now() / 1000
        };
      });
      
    console.log(`📊 Отфильтровано ${files.length} файлов`);
    
    return files;
  } catch (error) {
    console.error('❌ Ошибка при получении файлов:', error);
    return [];
  }
}

// Основная функция
async function main() {
  try {
    console.log('🚀 Запуск скрипта анализа случайных файлов...');
    console.log(`📍 Текущая директория: ${process.cwd()}`);
    
    // Проверим наличие переменных окружения
    console.log(`📍 TELEGRAM_API_ID: ${process.env.TELEGRAM_API_ID ? 'Задан' : 'Не задан'}`);
    console.log(`📍 TELEGRAM_API_HASH: ${process.env.TELEGRAM_API_HASH ? 'Задан' : 'Не задан'}`);
    console.log(`📍 TELEGRAM_SESSION: ${process.env.TELEGRAM_SESSION ? 'Задан' : 'Не задан'}`);
    
    // Получаем файлы
    const files = await fetchTelegramFiles();
    
    console.log(`📊 Файлы получены: ${files.length} шт.`);
    
    if (files.length === 0) {
      console.log('❌ Не удалось получить файлы');
      process.exit(1);
    }
    
    // Выбираем 10 случайных файлов
    const randomFiles = [];
    const shuffled = [...files].sort(() => 0.5 - Math.random());
    randomFiles.push(...shuffled.slice(0, 10));
    
    console.log('\n📋 10 случайных файлов:');
    console.log('==========================================');
    
    randomFiles.forEach((file: any, index: number) => {
      if (file.file_name) {
        const originalName = file.file_name;
        const normalizedName = normalizeString(originalName);
        const words = extractWords(normalizedName);
        
        console.log(`\n${index + 1}. Оригинал: "${originalName}"`);
        console.log(`   Нормализованный: "${normalizedName}"`);
        console.log(`   Слова: [${words.join(', ')}]`);
        console.log(`   ID сообщения: ${file.message_id}`);
        console.log(`   Размер: ${file.file_size} байт`);
        console.log(`   MIME тип: ${file.mime_type || 'не указан'}`);
      }
    });
    
    // Проверим, есть ли файл с ID 747
    const file747 = files.find((file: any) => file.message_id === 747);
    if (file747) {
      console.log('\n🎯 НАЙДЕН файл с ID 747:');
      console.log(`   Название: "${file747.file_name}"`);
      console.log(`   Размер: ${file747.file_size} байт`);
      
      // Покажем подробный анализ этого файла
      const originalName = file747.file_name;
      const normalizedName = normalizeString(originalName);
      const words = extractWords(normalizedName);
      
      console.log(`   Нормализованный: "${normalizedName}"`);
      console.log(`   Слова: [${words.join(', ')}]`);
    } else {
      console.log('\n❌ Файл с ID 747 НЕ НАЙДЕН');
    }
    
    console.log('\n==========================================');
    console.log('✅ Анализ завершен');
    
  } catch (error) {
    console.error('❌ Произошла ошибка:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
main();