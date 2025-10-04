/**
 * Скрипт для проверки записи книги в базе данных по Telegram ID
 *
 * Использование:
 * npx tsx src/scripts/check-book-record.ts <telegramFileId>
 * Пример: npx tsx src/scripts/check-book-record.ts 4379
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

async function checkBookRecord(telegramFileId: string) {
  console.log(`🚀 Проверяем запись книги с Telegram ID: ${telegramFileId}\n`);

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
      .select('*')
      .eq('telegram_file_id', telegramFileId);
    
    if (error) {
      console.error('❌ Ошибка при получении записей:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) {
      console.log('ℹ️  Записи не найдены');
      return;
    }
    
    console.log(`\n📊 Найдено записей: ${data.length}`);
    
    for (let i = 0; i < data.length; i++) {
      const book = data[i];
      console.log(`\n📄 Запись ${i + 1}:`);
      console.log(`  ID: ${book.id}`);
      console.log(`  Название: ${book.title}`);
      console.log(`  Автор: ${book.author}`);
      console.log(`  URL файла: ${book.file_url}`);
      console.log(`  Путь хранения: ${book.storage_path}`);
      console.log(`  Формат: ${book.file_format}`);
      console.log(`  Размер: ${book.file_size} байт`);
      console.log(`  Telegram ID: ${book.telegram_file_id}`);
      console.log(`  Дата создания: ${book.created_at}`);
      console.log(`  Дата обновления: ${book.updated_at}`);
    }
    
    console.log('\n✅ Проверка записей завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке записей:', error);
    process.exit(1);
  }
}

// Проверяем аргументы командной строки
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Необходимо указать Telegram ID файла');
  console.error('Использование: npx tsx src/scripts/check-book-record.ts <telegramFileId>');
  console.error('Пример: npx tsx src/scripts/check-book-record.ts 4379');
  process.exit(1);
}

const telegramFileId = args[0];

// Запускаем проверку записи
checkBookRecord(telegramFileId);