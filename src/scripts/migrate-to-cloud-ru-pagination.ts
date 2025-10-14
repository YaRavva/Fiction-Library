#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, createBucket } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Скрипт для пошаговой миграции файлов из Supabase Storage в Cloud.ru S3 с использованием пагинации
 * Обрабатывает файлы один за другим для большей надежности
 * Также сохраняет локальные копии файлов
 */

async function migrateToCloudRuPagination() {
  console.log('🚀 Начинаем пошаговую миграцию файлов из Supabase Storage в Cloud.ru S3 (с пагинацией)');
  
  // Проверка переменных окружения
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.S3_BUCKET_NAME || 'fiction-library-1760461283197';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    console.log('Требуются переменные:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  // Создаем директорию для локального бэкапа
  const backupDir = path.join(process.cwd(), 'local-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n🔧 Конфигурация миграции:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloud.ru Bucket: ${bucketName}`);
  console.log(`Локальный бэкап: ${backupDir}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('\n📚 Получаем список всех книг с файлами из базы данных (с пагинацией)...');
    
    // Получаем все книги, у которых есть файлы (с пагинацией)
    const PAGE_SIZE = 1000;
    let allBooksWithFiles: any[] = [];
    let page = 0;
    let booksPage: any[] = [];
    
    do {
      const { data, error: pageError } = await supabase
        .from('books')
        .select('id, title, author, file_url, storage_path, file_format, file_size, telegram_file_id')
        .not('file_url', 'is', null)
        .order('created_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (pageError) {
        console.error(`❌ Ошибка при получении страницы ${page + 1}:`, pageError.message);
        return;
      }
      
      booksPage = data;
      allBooksWithFiles = [...allBooksWithFiles, ...booksPage];
      
      console.log(`  📄 Загружена страница ${page + 1}, получено ${booksPage.length} книг`);
      
      page++;
    } while (booksPage.length === PAGE_SIZE);
    
    console.log(`✅ Найдено ${allBooksWithFiles.length} книг с файлами (все страницы)`);
    
    if (allBooksWithFiles.length === 0) {
      console.log('ℹ️  Нет книг с файлами для миграции');
      return;
    }
    
    // Фильтруем книги, которые еще не перенесены в Cloud.ru S3
    const booksToMigrate = allBooksWithFiles.filter(book => 
      !book.file_url || !book.file_url.includes('s3.cloud.ru')
    );
    
    console.log(`📋 Книг для миграции: ${booksToMigrate.length}`);
    
    if (booksToMigrate.length === 0) {
      console.log('ℹ️  Все файлы уже перенесены в Cloud.ru S3');
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
    
    console.log('\n🔄 Начинаем пошаговую миграцию файлов...');
    
    // Обрабатываем каждую книгу по одной
    for (let i = 0; i < booksToMigrate.length; i++) {
      const book = booksToMigrate[i];
      const progress = `${i + 1}/${booksToMigrate.length}`;
      
      // Форматированный вывод информации о книге
      const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
      const isDownloaded = '✅'; // Файл уже скачан из Supabase
      const isUploaded = book.file_url && book.file_url.includes('s3.cloud.ru') ? '✅' : '⏳';
      const isLinked = isUploaded === '✅' ? '✅' : '⏳';
      
      console.log(`\n[${progress}] ${book.author} - ${book.title} | Скачан: ${isDownloaded} | Загружен: ${isUploaded} | Привязан: ${isLinked} | ${fileSize}`);
      
      // Проверяем, есть ли storage_path
      if (!book.storage_path) {
        skippedCount++;
        continue;
      }
      
      try {
        // Скачиваем файл из Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.storage_path);
        
        if (downloadError) {
          console.error(`  ❌ Ошибка при скачивании файла ${book.storage_path}:`, downloadError.message);
          errorCount++;
          continue;
        }
        
        if (!fileData) {
          console.error(`  ❌ Файл ${book.storage_path} не найден в Supabase Storage`);
          errorCount++;
          continue;
        }
        
        // Преобразуем Blob в Buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        // Сохраняем локальную копию файла
        const localFilePath = path.join(backupDir, book.storage_path);
        const localDir = path.dirname(localFilePath);
        
        // Создаем директорию, если она не существует
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        
        // Сохраняем файл локально только если он еще не существует
        if (!fs.existsSync(localFilePath)) {
          fs.writeFileSync(localFilePath, fileBuffer);
          console.log(`  💾 Локальная копия сохранена: ${localFilePath}`);
        }
        
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
          console.error(`  ❌ Ошибка при обновлении записи в базе данных:`, updateError.message);
          errorCount++;
          continue;
        }
        
        migratedCount++;
        console.log(`  ✅ Файл успешно загружен и запись обновлена`);
        
        // Добавляем небольшую задержку между файлами для стабильности
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`  ❌ Ошибка при обработке книги:`, error.message);
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    console.log('\n📊 Итоги миграции:');
    console.log(`  ✅ Успешно перенесено: ${migratedCount} файлов`);
    console.log(`  ⚠️  Пропущено: ${skippedCount} файлов`);
    console.log(`  ❌ Ошибок: ${errorCount} файлов`);
    console.log(`  📚 Всего обработано: ${booksToMigrate.length} файлов`);
    console.log(`  📂 Локальный бэкап: ${backupDir}`);
    
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
  migrateToCloudRuPagination()
    .then(() => {
      console.log('\n✅ Скрипт миграции завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт миграции завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { migrateToCloudRuPagination };