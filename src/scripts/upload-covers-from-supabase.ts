#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { uploadFile } from '../lib/cloud-ru-s3-service';
import { Buffer } from 'buffer';

/**
 * Скрипт для загрузки обложек книг из Supabase Storage в Cloud.ru S3
 */

async function uploadCoversFromSupabase() {
  console.log('🚀 Начинаем загрузку обложек книг из Supabase Storage в Cloud.ru S3');
  
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
  
  console.log(`\n🔧 Конфигурация переноса обложек:`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Cloud.ru Bucket для обложек: ${coversBucketName}`);
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Получаем список всех книг из базы данных
    console.log('\n📚 Получаем список всех книг из базы данных...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, cover_url, cover_path')
      .not('cover_path', 'is', null)
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
        // Проверяем, есть ли путь к обложке
        if (!book.cover_path) {
          console.log(`  ⚠️  Нет пути к обложке`);
          skippedCount++;
          processedCount++;
          continue;
        }
        
        // Скачиваем обложку из Supabase Storage
        console.log(`  📥 Скачивание обложки из Supabase Storage: ${book.cover_path}`);
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('covers')
          .download(book.cover_path);
        
        if (downloadError) {
          console.log(`  ❌ Ошибка при скачивании обложки: ${downloadError.message}`);
          errorCount++;
          processedCount++;
          continue;
        }
        
        if (!fileData) {
          console.log(`  ❌ Обложка не найдена в Supabase Storage`);
          errorCount++;
          processedCount++;
          continue;
        }
        
        // Преобразуем Blob в Buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const coverBuffer = Buffer.from(arrayBuffer);
        
        // Определяем расширение файла
        const fileExtension = book.cover_path.includes('.') 
          ? book.cover_path.substring(book.cover_path.lastIndexOf('.')) 
          : '.jpg';
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
  uploadCoversFromSupabase()
    .then(() => {
      console.log('\n✅ Скрипт переноса обложек завершен');
    })
    .catch((error) => {
      console.error('\n❌ Скрипт переноса обложек завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { uploadCoversFromSupabase };