import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: '.env' });

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function checkBooksStructure() {
  console.log('Проверяем структуру таблицы books...');
  
  try {
    // Проверяем наличие записей с telegram_file_id = 4379
    console.log('Проверяем наличие записей с telegram_file_id = 4379...');
    const { data: existingRecords, error: existingError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, telegram_file_id')
      .eq('telegram_file_id', '4379');
    
    if (existingError) {
      console.error('Ошибка при проверке существующих записей:', existingError);
      return;
    }
    
    if (existingRecords && existingRecords.length > 0) {
      console.log(`Найдены записи с telegram_file_id = 4379:`);
      existingRecords.forEach(record => {
        console.log(`  - ID: ${record.id}, Название: ${record.title}, Автор: ${record.author}`);
      });
    } else {
      console.log('Записей с telegram_file_id = 4379 не найдено');
    }
    
    // Проверяем наличие записей с заполненным telegram_file_id
    console.log('\nПроверяем наличие записей с заполненным telegram_file_id...');
    const { data: allRecords, error: allError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, telegram_file_id')
      .not('telegram_file_id', 'is', null)
      .limit(10);
    
    if (allError) {
      console.error('Ошибка при получении записей с telegram_file_id:', allError);
      return;
    }
    
    console.log(`Найдено ${allRecords.length} записей с заполненным telegram_file_id:`);
    allRecords.forEach(record => {
      console.log(`  - ID: ${record.id}, Название: ${record.title}, Автор: ${record.author}, File ID: ${record.telegram_file_id}`);
    });
  } catch (error) {
    console.error('Ошибка при проверке структуры таблицы books:', error);
  }
}

// Выполняем проверку
checkBooksStructure();