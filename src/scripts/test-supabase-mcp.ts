import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

async function testSupabaseMCP() {
  console.log('Тестирование подключения к Supabase через MCP...');
  
  try {
    // Проверяем наличие необходимых переменных окружения
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('❌ Отсутствуют необходимые переменные окружения Supabase');
      console.log('Требуются переменные:');
      console.log('- NEXT_PUBLIC_SUPABASE_URL');
      console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.log('- SUPABASE_SERVICE_ROLE_KEY');
      return;
    }
    
    console.log('✅ Все необходимые переменные окружения найдены');
    console.log(`Supabase URL: ${supabaseUrl}`);
    
    // Попробуем подключиться к Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Проверим подключение, сделав простой запрос
    console.log('🔍 Тестируем подключение к базе данных...');
    const { data, error } = await supabase
      .from('books')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Ошибка подключения к Supabase:', error.message);
      return;
    }
    
    console.log('✅ Подключение к Supabase успешно установлено');
    console.log(`📊 Количество книг в базе: ${data?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании Supabase MCP:', error);
  }
}

testSupabaseMCP().catch(console.error);