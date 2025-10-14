#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, createBucket } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

/**
 * Скрипт для миграции файлов из Supabase Storage в Cloud.ru S3 с использованием AWS SDK
 * Обрабатывает файлы один за другим для большей надежности
 */

async function migrateToCloudRuWithAwsSdk() {
  console.log('🚀 Начинаем миграцию файлов из Supabase Storage в Cloud.ru S3 с использованием AWS SDK');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.S3_BUCKET_NAME || `books-${Date.now()}`;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  console.log(`\n🔧 Конфигурация миграции:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloud.ru Bucket: ${bucketName}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('\n📚 Получаем список всех книг с файлами из базы данных...');
    
    // Получаем все книги, у которых есть файлы
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url, storage_path, file_format, file_size, telegram_file_id')
      .not('file_url', 'is', null)
      .order('created_at', { ascending: true });
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError.message);
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг с файлами`);
    
    if (books.length === 0) {
      console.log('ℹ️  Нет книг с файлами для миграции');
      return;
    }
    
    // Создаем новый бакет для миграции
    console.log(`\n📦 Создаем новый бакет "${bucketName}"...`);
    try {
      await createBucket(bucketName);
      console.log(`✅ Бакет "${bucketName}" успешно создан`);
    } catch (error: any) {
      console.log(`⚠️  Бакет "${bucketName}" уже существует или ошибка при создании: ${error.message}`);
    }
    
    // Счетчики для статистики
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 Начинаем миграцию файлов...');
    
    // Обрабатываем каждую книгу по одной
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const progress = `${i + 1}/${books.length}`;
      
      // Форматированный вывод информации о книге
      const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
      const isDownloaded = '✅'; // Файл уже скачан из Supabase
      const isUploaded = book.file_url && book.file_url.includes('s3.cloud.ru') ? '✅' : '⏳';
      const isLinked = isUploaded === '✅' ? '✅' : '⏳';
      
      console.log(`\n[${progress}] ${book.author} - ${book.title} | Скачан: ${isDownloaded} | Загружен: ${isUploaded} | Привязан: ${isLinked} | ${fileSize}`);
      
      // Проверяем, есть ли уже файл в Cloud.ru S3
      if (book.file_url && book.file_url.includes('s3.cloud.ru')) {
        skippedCount++;
        continue;
      }
      
      // Проверяем, есть ли storage_path
      if (!book.storage_path) {
        errorCount++;
        continue;
      }
      
      try {
        // Скачиваем файл из Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.storage_path);
        
        if (downloadError) {
          errorCount++;
          continue;
        }
        
        if (!fileData) {
          errorCount++;
          continue;
        }
        
        // Преобразуем Blob в Buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        // Загружаем файл в Cloud.ru S3 с использованием AWS SDK
        const uploadResult = await uploadFile(bucketName, book.storage_path, fileBuffer);
        
        // Обновляем запись в базе данных
        const newFileUrl = `https://s3.cloud.ru/${bucketName}/${book.storage_path}`;
        
        const { error: updateError } = await supabase
          .from('books')
          .update({
            file_url: newFileUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id);
        
        if (updateError) {
          errorCount++;
          continue;
        }
        
        migratedCount++;
        
        // Добавляем небольшую задержку между файлами для стабильности
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги миграции:');
    console.log(`  ✅ Успешно перенесено: ${migratedCount} файлов`);
    console.log(`  ⚠️  Пропущено: ${skippedCount} файлов`);
    console.log(`  ❌ Ошибок: ${errorCount} файлов`);
    console.log(`  📚 Всего обработано: ${books.length} файлов`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Миграция успешно завершена!');
    } else {
      console.log(`\n⚠️  Миграция завершена с ${errorCount} ошибками`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка во время миграции:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск миграции
if (require.main === module) {
  migrateToCloudRuWithAwsSdk()
    .then(() => {
      console.log('\n✅ Скрипт миграции завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт миграции завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { migrateToCloudRuWithAwsSdk };