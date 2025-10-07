import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testQueueProcessing() {
  try {
    console.log('🔍 Тестирование обработки очереди загрузки файлов\n');
    
    // Добавляем несколько тестовых задач в очередь
    console.log('📥 Добавляем тестовые задачи в очередь...');
    
    const testTasks = [
      { message_id: 4379, channel_id: '1515159552', priority: 1 },
      { message_id: 4378, channel_id: '1515159552', priority: 1 },
      { message_id: 4377, channel_id: '1515159552', priority: 1 }
    ];
    
    const { data, error } = await supabaseAdmin
      .from('telegram_download_queue')
      .insert(testTasks);
    
    if (error) {
      console.error('❌ Ошибка при добавлении задач в очередь:', error.message);
    } else {
      console.log('✅ Тестовые задачи добавлены в очередь');
    }
    
    // Проверяем содержимое очереди
    console.log('\n📋 Проверяем содержимое очереди...');
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from('telegram_download_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queueError) {
      console.error('❌ Ошибка при получении очереди:', queueError.message);
    } else {
      console.log(`✅ Найдено ${queueItems?.length || 0} задач в очереди:`);
      queueItems?.forEach((item, index) => {
        console.log(`   ${index + 1}. ID: ${item.id}, Message ID: ${item.message_id}, Status: ${item.status}`);
      });
    }
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании очереди:', error);
    process.exit(1);
  }
}

testQueueProcessing();