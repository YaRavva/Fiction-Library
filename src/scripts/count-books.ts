import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function countBooks() {
  try {
    // Используем правильные переменные окружения для облачного Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены переменные окружения Supabase');
      return;
    }

    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Получаем количество книг в базе данных
    const { count, error } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Ошибка при получении количества книг:', error);
      return;
    }

    console.log(`📚 Книг в базе данных: ${count}`);
    
    // Также получим количество сообщений в Telegram, которые были обработаны
    const { count: processedCount, error: processedError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });

    if (processedError) {
      console.error('❌ Ошибка при получении количества обработанных сообщений:', processedError);
      return;
    }

    console.log(`📨 Обработанных сообщений Telegram: ${processedCount}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  countBooks();
}