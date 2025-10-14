#!/usr/bin/env tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkBooksCountImproved() {
  console.log('=== Проверка количества книг в базе данных (улучшенная версия) ===');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ОШИБКА: Не установлены необходимые переменные окружения');
    return;
  }
  
  // Создание клиента Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // 1. Получаем общее количество книг
    console.log('\n1. Получение общего количества книг...');
    const { count: totalCount, error: countError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Ошибка при получении общего количества книг:', countError.message);
      return;
    }
    
    console.log(`✅ Всего книг в базе данных: ${totalCount}`);
    
    // 2. Получаем количество книг с файлами
    console.log('\n2. Получение количества книг с файлами...');
    const { count: booksWithFilesCount, error: booksWithFilesCountError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('file_url', 'is', null);
    
    if (booksWithFilesCountError) {
      console.error('❌ Ошибка при получении количества книг с файлами:', booksWithFilesCountError.message);
      return;
    }
    
    console.log(`✅ Книг с файлами: ${booksWithFilesCount}`);
    
    // 3. Получаем количество книг без файлов
    console.log('\n3. Получение количества книг без файлов...');
    const { count: booksWithoutFilesCount, error: booksWithoutFilesCountError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('file_url', null);
    
    if (booksWithoutFilesCountError) {
      console.error('❌ Ошибка при получении количества книг без файлов:', booksWithoutFilesCountError.message);
      return;
    }
    
    console.log(`✅ Книг без файлов: ${booksWithoutFilesCount}`);
    
    // 4. Получаем список всех книг с файлами (с пагинацией)
    console.log('\n4. Получение списка всех книг с файлами (с пагинацией)...');
    const PAGE_SIZE = 1000;
    let allBooksWithFiles: any[] = [];
    let page = 0;
    
    while (true) {
      const { data: booksPage, error: pageError } = await supabase
        .from('books')
        .select('id, title, author, file_url, storage_path, file_format, file_size')
        .not('file_url', 'is', null)
        .order('created_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (pageError) {
        console.error(`❌ Ошибка при получении страницы ${page + 1}:`, pageError.message);
        return;
      }
      
      // Добавляем книги из текущей страницы
      allBooksWithFiles = [...allBooksWithFiles, ...booksPage];
      
      console.log(`  📄 Загружена страница ${page + 1}, получено ${booksPage.length} книг`);
      
      // Если получено меньше книг, чем размер страницы, значит это последняя страница
      if (booksPage.length < PAGE_SIZE) {
        break;
      }
      
      page++;
    }
    
    console.log(`✅ Получено ${allBooksWithFiles.length} книг с файлами (все страницы)`);
    
    // 5. Проверяем, есть ли книги, уже перенесенные в Cloud.ru S3
    const booksInCloudRu = allBooksWithFiles.filter(book => 
      book.file_url && book.file_url.includes('s3.cloud.ru')
    );
    
    console.log(`📦 Книг уже перенесено в Cloud.ru S3: ${booksInCloudRu.length}`);
    
    // 6. Проверяем, есть ли книги, которые еще не перенесены
    const booksNotInCloudRu = allBooksWithFiles.filter(book => 
      !book.file_url || !book.file_url.includes('s3.cloud.ru')
    );
    
    console.log(`⏳ Книг, ожидающих переноса в Cloud.ru S3: ${booksNotInCloudRu.length}`);
    
    console.log('\n📊 Сводная статистика:');
    console.log(`  📚 Всего книг: ${totalCount}`);
    console.log(`  📂 Книг с файлами: ${booksWithFilesCount}`);
    console.log(`  🚫 Книг без файлов: ${booksWithoutFilesCount}`);
    console.log(`  ☁️  Книг уже в Cloud.ru S3: ${booksInCloudRu.length}`);
    console.log(`  🔄 Книг для переноса: ${booksNotInCloudRu.length}`);
    
    // 7. Показываем примеры книг, которые еще не перенесены
    if (booksNotInCloudRu.length > 0) {
      console.log('\n📋 Примеры книг, ожидающих переноса:');
      booksNotInCloudRu.slice(0, 10).forEach((book, index) => {
        const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)}MB` : 'N/A';
        console.log(`  ${index + 1}. ${book.author} - ${book.title} | ${fileSize}`);
      });
      
      if (booksNotInCloudRu.length > 10) {
        console.log(`  ... и еще ${booksNotInCloudRu.length - 10} книг`);
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error.message);
    console.error('Полный стек ошибки:');
    console.error(error);
  }
}

// Запуск проверки
if (require.main === module) {
  checkBooksCountImproved()
    .then(() => {
      console.log('\n✅ Проверка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Проверка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { checkBooksCountImproved };