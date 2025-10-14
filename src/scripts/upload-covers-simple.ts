#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

/**
 * Упрощенный скрипт для загрузки обложек книг в Cloud.ru S3
 * Использует уже существующие данные в базе данных
 */

async function uploadCoversSimple() {
  console.log('🚀 Начинаем загрузку обложек книг в Cloud.ru S3 (упрощенная версия)');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const coversBucketName = process.env.S3_COVERS_BUCKET_NAME || 'fiction-library-covers';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    console.log('- S3_COVERS_BUCKET_NAME (опционально, по умолчанию: fiction-library-covers)');
    return;
  }
  
  console.log(`\n🔧 Конфигурация загрузки обложек:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloud.ru Bucket для обложек: ${coversBucketName}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Получаем список всех книг из базы данных, у которых есть обложки в Telegram
    console.log('\n📚 Получаем список книг с обложками из базы данных...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, cover_url')
      .not('cover_url', 'is', null)
      .order('created_at', { ascending: true });
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError.message);
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг с обложками`);
    
    // Фильтруем книги, у которых обложки еще не перенесены в Cloud.ru S3
    const booksToMigrate = books.filter(book => 
      book.cover_url && !book.cover_url.includes('s3.cloud.ru')
    );
    
    console.log(`📋 Книг для переноса обложек: ${booksToMigrate.length}`);
    
    if (booksToMigrate.length === 0) {
      console.log('ℹ️  Все обложки уже перенесены в Cloud.ru S3');
      return;
    }
    
    // Счетчики для статистики
    let processedCount = 0;
    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 Начинаем перенос обложек...');
    
    // Обрабатываем каждую книгу по одной
    for (let i = 0; i < booksToMigrate.length; i++) {
      const book = booksToMigrate[i];
      const progress = `${i + 1}/${booksToMigrate.length}`;
      
      console.log(`\n[${progress}] ${book.author} - ${book.title}`);
      
      try {
        // Проверяем, есть ли URL обложки
        if (!book.cover_url) {
          console.log(`  ⚠️  Нет URL обложки`);
          skippedCount++;
          processedCount++;
          continue;
        }
        
        // Скачиваем обложку по URL
        console.log(`  📥 Скачивание обложки из: ${book.cover_url}`);
        const response = await fetch(book.cover_url);
        
        if (!response.ok) {
          console.log(`  ❌ Ошибка при скачивании обложки: ${response.status} ${response.statusText}`);
          errorCount++;
          processedCount++;
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const coverBuffer = Buffer.from(arrayBuffer);
        
        // Определяем расширение файла из URL
        const urlParts = book.cover_url.split('.');
        const fileExtension = urlParts.length > 1 ? `.${urlParts[urlParts.length - 1].split('?')[0]}` : '.jpg';
        const fileName = `${book.id}${fileExtension}`;
        
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
          processedCount++;
          continue;
        }
        
        uploadedCount++;
        console.log(`  ✅ Обложка успешно загружена и запись обновлена`);
        processedCount++;
        
        // Добавляем небольшую задержку между файлами для стабильности
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`  ❌ Ошибка при обработке книги:`, error.message);
        errorCount++;
        processedCount++;
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги переноса обложек:');
    console.log(`  ✅ Успешно обработано: ${processedCount} книг`);
    console.log(`  📤 Загружено обложек: ${uploadedCount} шт.`);
    console.log(`  ⚠️  Пропущено: ${skippedCount} книг`);
    console.log(`  ❌ Ошибок: ${errorCount} шт.`);
    console.log(`  📚 Всего для переноса: ${booksToMigrate.length} книг`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Перенос обложек успешно завершен!');
    } else {
      console.log(`\n⚠️  Перенос обложек завершен с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время переноса обложек:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск переноса обложек
if (require.main === module) {
  uploadCoversSimple()
    .then(() => {
      console.log('\n✅ Скрипт переноса обложек завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт переноса обложек завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { uploadCoversSimple };