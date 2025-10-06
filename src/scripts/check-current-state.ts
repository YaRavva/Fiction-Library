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

async function checkCurrentState() {
  console.log('Проверяем текущее состояние таблиц...');
  
  try {
    // Проверяем запись в telegram_processed_messages для message_id = 4379
    console.log('\n1. Проверяем запись в telegram_processed_messages для message_id = 4379...');
    const { data: telegramRecords, error: telegramError } = await supabaseAdmin
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', '4379');
    
    if (telegramError) {
      console.error('Ошибка при проверке telegram_processed_messages:', telegramError);
      return;
    }
    
    if (telegramRecords && telegramRecords.length > 0) {
      console.log(`Найдена запись в telegram_processed_messages:`);
      console.log(`  ID: ${telegramRecords[0].id}`);
      console.log(`  Book ID: ${telegramRecords[0].book_id}`);
      console.log(`  Telegram file ID: ${telegramRecords[0].telegram_file_id}`);
    } else {
      console.log('Запись в telegram_processed_messages для message_id = 4379 не найдена');
    }
    
    // Проверяем запись в books для telegram_file_id = 4379
    console.log('\n2. Проверяем запись в books для telegram_file_id = 4379...');
    const { data: bookRecords, error: bookError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, telegram_file_id')
      .eq('telegram_file_id', '4379');
    
    if (bookError) {
      console.error('Ошибка при проверке books:', bookError);
      return;
    }
    
    if (bookRecords && bookRecords.length > 0) {
      console.log(`Найдена запись в books с telegram_file_id = 4379:`);
      bookRecords.forEach(record => {
        console.log(`  ID: ${record.id}, Название: ${record.title}, Автор: ${record.author}`);
      });
    } else {
      console.log('Запись в books с telegram_file_id = 4379 не найдена');
    }
    
    // Проверяем общее количество записей в telegram_processed_messages с заполненным telegram_file_id
    console.log('\n3. Проверяем общее количество записей в telegram_processed_messages с заполненным telegram_file_id...');
    const { count: telegramFileCount, error: telegramFileCountError } = await supabaseAdmin
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
    
    if (telegramFileCountError) {
      console.error('Ошибка при подсчете записей в telegram_processed_messages:', telegramFileCountError);
      return;
    }
    
    console.log(`Количество записей в telegram_processed_messages с заполненным telegram_file_id: ${telegramFileCount || 0}`);
    
    // Проверяем общее количество записей в books с заполненным telegram_file_id
    console.log('\n4. Проверяем общее количество записей в books с заполненным telegram_file_id...');
    const { count: bookFileCount, error: bookFileCountError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
    
    if (bookFileCountError) {
      console.error('Ошибка при подсчете записей в books:', bookFileCountError);
      return;
    }
    
    console.log(`Количество записей в books с заполненным telegram_file_id: ${bookFileCount || 0}`);
    
  } catch (error) {
    console.error('Ошибка при проверке текущего состояния:', error);
  }
}

// Выполняем проверку
checkCurrentState();