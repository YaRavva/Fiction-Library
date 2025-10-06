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

async function detailedCheck() {
  console.log('Детальная проверка наличия дубликатов telegram_file_id = 4379...');
  
  try {
    // Проверяем все записи в telegram_processed_messages с telegram_file_id = 4379
    console.log('\n1. Проверяем все записи в telegram_processed_messages с telegram_file_id = 4379...');
    const { data: telegramRecords, error: telegramError } = await supabaseAdmin
      .from('telegram_processed_messages')
      .select('*')
      .eq('telegram_file_id', '4379');
    
    if (telegramError) {
      console.error('Ошибка при проверке telegram_processed_messages:', telegramError);
      return;
    }
    
    if (telegramRecords && telegramRecords.length > 0) {
      console.log(`Найдено ${telegramRecords.length} записей в telegram_processed_messages с telegram_file_id = 4379:`);
      telegramRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Book ID: ${record.book_id}, Message ID: ${record.message_id}`);
      });
    } else {
      console.log('Записи в telegram_processed_messages с telegram_file_id = 4379 не найдены');
    }
    
    // Проверяем все записи в books с telegram_file_id = 4379
    console.log('\n2. Проверяем все записи в books с telegram_file_id = 4379...');
    const { data: bookRecords, error: bookError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, telegram_file_id')
      .eq('telegram_file_id', '4379');
    
    if (bookError) {
      console.error('Ошибка при проверке books:', bookError);
      return;
    }
    
    if (bookRecords && bookRecords.length > 0) {
      console.log(`Найдено ${bookRecords.length} записей в books с telegram_file_id = 4379:`);
      bookRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Название: ${record.title}, Автор: ${record.author}`);
      });
    } else {
      console.log('Записи в books с telegram_file_id = 4379 не найдены');
    }
    
    // Проверяем наличие ограничений в таблице books
    console.log('\n3. Проверяем наличие ограничений в таблице books...');
    const { data: constraints, error: constraintsError } = await supabaseAdmin
      .from('pg_constraint')
      .select('*')
      .eq('conname', 'books_telegram_file_id_unique');
    
    if (constraintsError) {
      console.error('Ошибка при проверке ограничений:', constraintsError);
      return;
    }
    
    if (constraints && constraints.length > 0) {
      console.log('Найдено ограничение уникальности для telegram_file_id в таблице books');
    } else {
      console.log('Ограничение уникальности для telegram_file_id в таблице books не найдено');
    }
    
    // Проверяем, есть ли другие записи в books с telegram_file_id, которые не равны null
    console.log('\n4. Проверяем другие записи в books с заполненным telegram_file_id...');
    const { data: otherBookRecords, error: otherBookError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, telegram_file_id')
      .not('telegram_file_id', 'is', null)
      .limit(10);
    
    if (otherBookError) {
      console.error('Ошибка при проверке других записей в books:', otherBookError);
      return;
    }
    
    if (otherBookRecords && otherBookRecords.length > 0) {
      console.log(`Найдено ${otherBookRecords.length} записей в books с заполненным telegram_file_id:`);
      otherBookRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Название: ${record.title}, Автор: ${record.author}, File ID: ${record.telegram_file_id}`);
      });
    } else {
      console.log('Других записей в books с заполненным telegram_file_id не найдено');
    }
    
  } catch (error) {
    console.error('Ошибка при детальной проверке:', error);
  }
}

// Выполняем проверку
detailedCheck();