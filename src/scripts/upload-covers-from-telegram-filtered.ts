#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { uploadFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';
import { MetadataParser } from '../lib/telegram/parser';

/**
 * Скрипт для загрузки обложек книг из Telegram-канала в Cloud.ru S3
 * Только для сообщений, которые определены как книги
 */

async function uploadCoversFromTelegramFiltered() {
  console.log('🚀 Начинаем загрузку обложек книг из Telegram-канала в Cloud.ru S3 (с фильтрацией)');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const telegramApiId = process.env.TELEGRAM_API_ID;
  const telegramApiHash = process.env.TELEGRAM_API_HASH;
  const telegramSession = process.env.TELEGRAM_SESSION;
  const telegramMetadataChannel = process.env.TELEGRAM_METADATA_CHANNEL;
  const coversBucketName = process.env.S3_COVERS_BUCKET_NAME || 'fiction-library-covers';
  
  if (!supabaseUrl || !supabaseServiceKey || !telegramApiId || !telegramApiHash || !telegramSession || !telegramMetadataChannel) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    console.log('- TELEGRAM_API_ID');
    console.log('- TELEGRAM_API_HASH');
    console.log('- TELEGRAM_SESSION');
    console.log('- TELEGRAM_METADATA_CHANNEL');
    console.log('- S3_COVERS_BUCKET_NAME (опционально, по умолчанию: fiction-library-covers)');
    return;
  }
  
  // Создаем директорию для локального бэкапа обложек
  const backupDir = path.join(process.cwd(), 'local-backup-covers');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🔧 Конфигурация загрузки обложек:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Telegram канал: ${telegramMetadataChannel}`);
  console.log(`Cloud.ru Bucket для обложек: ${coversBucketName}`);
  console.log(`Локальный бэкап: ${backupDir}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Создание Telegram клиента
    console.log('\n📱 Подключение к Telegram...');
    const client = new TelegramClient(
      new StringSession(telegramSession),
      parseInt(telegramApiId),
      telegramApiHash,
      { connectionRetries: 5 }
    );
    
    await client.start({
      botAuthToken: process.env.BOT_TOKEN || '',
    });
    
    console.log('✅ Подключение к Telegram установлено');
    
    // Получаем информацию о канале
    console.log('\n📡 Получение информации о канале...');
    const channel = await client.getEntity(telegramMetadataChannel);
    console.log(`✅ Канал: ${(channel as any).title || 'Неизвестно'}`);
    
    // Получаем список всех книг из базы данных
    console.log('\n📚 Получаем список всех книг из базы данных...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, cover_url, telegram_post_id')
      .order('created_at', { ascending: true });
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError.message);
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг`);
    
    // Фильтруем книги, у которых еще нет обложек
    const booksWithoutCovers = books.filter(book => !book.cover_url);
    console.log(`📋 Книг без обложек: ${booksWithoutCovers.length}`);
    
    if (booksWithoutCovers.length === 0) {
      console.log('ℹ️  Все книги уже имеют обложки');
      return;
    }
    
    // Счетчики для статистики
    let processedCount = 0;
    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let notBookCount = 0;
    
    console.log('\n🔄 Начинаем загрузку обложек...');
    
    // Обрабатываем каждую книгу по одной
    for (let i = 0; i < booksWithoutCovers.length; i++) {
      const book = booksWithoutCovers[i];
      const progress = `${i + 1}/${booksWithoutCovers.length}`;
      
      // Проверяем, есть ли у книги telegram_post_id
      if (!book.telegram_post_id) {
        console.log(`\n[${progress}] ${book.author} - ${book.title} | ⚠️  Нет telegram_post_id`);
        skippedCount++;
        continue;
      }
      
      console.log(`\n[${progress}] ${book.author} - ${book.title} | 📋 Telegram ID: ${book.telegram_post_id}`);
      
      try {
        // Получаем сообщение из Telegram-канала
        const messages = await client.getMessages(channel, {
          ids: [parseInt(book.telegram_post_id)]
        });
        
        if (!messages || messages.length === 0 || !messages[0]) {
          console.log(`  ⚠️  Сообщение не найдено в Telegram`);
          skippedCount++;
          continue;
        }
        
        const msg = messages[0];
        
        // Проверяем, является ли сообщение книгой
        if (!msg.text) {
          console.log(`  ⚠️  Сообщение не содержит текста`);
          notBookCount++;
          continue;
        }
        
        try {
          // Пытаемся распарсить сообщение как книгу
          const metadata = MetadataParser.parseMessage(msg.text);
          
          // Проверяем, есть ли у книги автор и название
          if (!metadata.author || !metadata.title) {
            console.log(`  ⚠️  Сообщение не является книгой (нет автора или названия)`);
            notBookCount++;
            continue;
          }
          
          console.log(`  📚 Найдена книга: ${metadata.author} - ${metadata.title}`);
        } catch (parseError) {
          console.log(`  ⚠️  Сообщение не является книгой (ошибка парсинга)`);
          notBookCount++;
          continue;
        }
        
        // Проверяем, есть ли вложения в сообщении
        if (!msg.media) {
          console.log(`  ⚠️  Нет вложений в сообщении`);
          skippedCount++;
          continue;
        }
        
        // Проверяем, является ли вложение фото
        if (!(msg.media instanceof Api.MessageMediaPhoto)) {
          console.log(`  ⚠️  Вложение не является фото`);
          skippedCount++;
          continue;
        }
        
        // Скачиваем фото
        console.log(`  📥 Скачивание обложки...`);
        const buffer = await client.downloadMedia(msg, {
          outputFile: new Buffer(0),
        });
        
        if (!buffer) {
          console.log(`  ❌ Ошибка при скачивании обложки`);
          errorCount++;
          continue;
        }
        
        // Преобразуем в Buffer, если это не так
        let coverBuffer: Buffer;
        if (buffer instanceof Uint8Array) {
          coverBuffer = Buffer.from(buffer);
        } else {
          coverBuffer = buffer as unknown as Buffer;
        }
        
        // Определяем расширение файла
        const fileExtension = '.jpg'; // По умолчанию JPG для фото из Telegram
        const fileName = `${book.id}${fileExtension}`;
        
        // Сохраняем локальную копию обложки
        const localFilePath = path.join(backupDir, fileName);
        fs.writeFileSync(localFilePath, coverBuffer);
        console.log(`  💾 Локальная копия сохранена: ${localFilePath}`);
        
        // Загружаем обложку в Cloud.ru S3
        console.log(`  ☁️  Загрузка обложки в Cloud.ru S3...`);
        const uploadResult = await uploadFile(coversBucketName, fileName, coverBuffer);
        
        // Обновляем запись в базе данных
        const newCoverUrl = `https://s3.cloud.ru/${coversBucketName}/${fileName}`;
        
        const { error: updateError } = await supabase
          .from('books')
          .update({
            cover_url: newCoverUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id);
        
        if (updateError) {
          console.error(`  ❌ Ошибка при обновлении записи в базе данных:`, updateError.message);
          errorCount++;
          continue;
        }
        
        uploadedCount++;
        console.log(`  ✅ Обложка успешно загружена и запись обновлена`);
        processedCount++;
        
        // Добавляем небольшую задержку между файлами для стабильности
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`  ❌ Ошибка при обработке книги:`, error.message);
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги загрузки обложек:');
    console.log(`  ✅ Успешно обработано: ${processedCount} книг`);
    console.log(`  📤 Загружено обложек: ${uploadedCount} шт.`);
    console.log(`  ⚠️  Пропущено: ${skippedCount} книг`);
    console.log(`  ❌ Ошибок: ${errorCount} шт.`);
    console.log(`  📚 Не книги: ${notBookCount} сообщений`);
    console.log(`  📚 Всего без обложек: ${booksWithoutCovers.length} книг`);
    console.log(`  📂 Локальный бэкап: ${backupDir}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Загрузка обложек успешно завершена!');
    } else {
      console.log(`\n⚠️  Загрузка обложек завершена с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время загрузки обложек:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск загрузки обложек
if (require.main === module) {
  uploadCoversFromTelegramFiltered()
    .then(() => {
      console.log('\n✅ Скрипт загрузки обложек завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт загрузки обложек завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { uploadCoversFromTelegramFiltered };