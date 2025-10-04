/**
 * Скрипт для проверки содержимого бакета books в Supabase Storage
 * Показывает список файлов и их пути для проверки правильности загрузки
 *
 * Использование:
 * npx tsx src/scripts/check-storage-bucket.ts
 */

// Загружаем переменные окружения
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

async function checkStorageBucket() {
  console.log('🚀 Проверяем содержимое бакета books...\n');

  try {
    // Создаем клиент Supabase с service role key для доступа к Storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log('✅ Подключение к Supabase установлено');
    
    // Получаем список файлов в бакете books
    console.log('📥 Получаем список файлов в бакете books...');
    
    const { data, error } = await supabase
      .storage
      .from('books')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('❌ Ошибка при получении списка файлов:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) {
      console.log('ℹ️  Бакет books пуст');
      return;
    }
    
    console.log(`\n📊 Найдено файлов: ${data.length}`);
    console.log('\n📄 Список файлов:');
    console.log('----------------------------------------');
    
    // Сортируем файлы по имени для удобства просмотра
    data.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const file of data) {
      console.log(`📄 ${file.name}`);
      console.log(`   Размер: ${file.metadata?.size || 'неизвестно'} байт`);
      console.log(`   Дата создания: ${file.created_at || 'неизвестно'}`);
      console.log(`   Путь: ${file.id}`);
      console.log('----------------------------------------');
      
      // Проверяем, нет ли вложенных папок
      if (file.name.includes('/')) {
        console.warn(`⚠️  Файл находится во вложенной папке: ${file.name}`);
      }
    }
    
    // Проверяем, есть ли вложенные папки
    const filesWithFolders = data.filter(file => file.name.includes('/'));
    if (filesWithFolders.length > 0) {
      console.log(`\n⚠️  Найдены файлы во вложенных папках: ${filesWithFolders.length}`);
      for (const file of filesWithFolders) {
        console.log(`  - ${file.name}`);
      }
    } else {
      console.log('\n✅ Все файлы находятся в корневой папке бакета');
    }
    
    console.log('\n✅ Проверка содержимого бакета завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке содержимого бакета:', error);
    process.exit(1);
  }
}

// Запускаем проверку
checkStorageBucket();