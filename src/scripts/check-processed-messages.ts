import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkProcessedMessages() {
  console.log('🔍 Проверка обработанных сообщений в Supabase...');
  
  // Проверяем, что необходимые переменные установлены
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Отсутствуют необходимые переменные окружения для подключения к Supabase');
    console.log('Проверьте файл .env в корне проекта');
    return;
  }
  
  console.log('✅ Переменные окружения для Supabase найдены');
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Получаем последние 10 обработанных сообщений
    const { data, error } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Ошибка при получении данных из Supabase:', error);
      return;
    }
    
    console.log(`✅ Получено ${data.length} записей из таблицы telegram_processed_messages:`);
    console.table(data);
    
  } catch (error) {
    console.error('❌ Ошибка при проверке обработанных сообщений:', error);
  }
}

checkProcessedMessages();