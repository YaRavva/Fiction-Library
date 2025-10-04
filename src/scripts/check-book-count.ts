/**
 * Скрипт для проверки количества записей книг с определенным названием и автором
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

async function checkBookCount() {
  console.log('🚀 Проверяем количество записей книг...\n');

  try {
    // Создаем клиент Supabase с service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log('✅ Подключение к Supabase установлено');
    
    // Получаем записи из базы данных
    console.log('📥 Получаем записи из базы данных...');
    
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .eq('title', 'Вилма Кадлечкова - Мицелий')
      .eq('author', 'Unknown');
    
    if (error) {
      console.error('❌ Ошибка при получении записей:', error);
      process.exit(1);
    }
    
    console.log(`\n📊 Найдено записей: ${data.length}`);
    
    if (data.length > 0) {
      console.log('Список ID записей:');
      for (const book of data) {
        console.log(`  - ${book.id}`);
      }
    }
    
    console.log('\n✅ Проверка записей завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке записей:', error);
    process.exit(1);
  }
}

// Запускаем проверку записей
checkBookCount();