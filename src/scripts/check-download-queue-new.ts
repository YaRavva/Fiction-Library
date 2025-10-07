import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDownloadQueue() {
  try {
    console.log('🔍 Проверка очереди загрузки файлов...\n');
    
    // Get all tasks from telegram_download_queue
    const { data: tasks, error } = await supabase
      .from('telegram_download_queue')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Ошибка при получении задач из очереди:', error.message);
      process.exit(1);
    }
    
    console.log(`📊 Всего задач в очереди: ${tasks?.length || 0}\n`);
    
    if (!tasks || tasks.length === 0) {
      console.log('📭 Очередь загрузки пуста');
      return;
    }
    
    // Group tasks by status
    const statusGroups: { [key: string]: any[] } = {};
    tasks.forEach(task => {
      const status = task.status || 'unknown';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(task);
    });
    
    console.log('📈 Статистика по статусам:');
    Object.keys(statusGroups).forEach(status => {
      console.log(`  ${status}: ${statusGroups[status].length}`);
    });
    
    console.log('\n📥 Последние 10 задач (новые первыми):');
    tasks.slice(0, 10).forEach((task, index) => {
      console.log(`  ${index + 1}. ID: ${task.id}`);
      console.log(`     Message ID: ${task.message_id}`);
      console.log(`     Status: ${task.status}`);
      console.log(`     Created: ${task.created_at}`);
      console.log(`     Priority: ${task.priority}`);
      console.log('     ---');
    });
    
    // Check for pending tasks
    const pendingTasks = statusGroups['pending'] || [];
    if (pendingTasks.length > 0) {
      console.log(`\n⏳ Ожидающие задачи (${pendingTasks.length}):`);
      pendingTasks.slice(0, 5).forEach((task, index) => {
        console.log(`  ${index + 1}. ID: ${task.id}`);
        console.log(`     Message ID: ${task.message_id}`);
        console.log(`     Created: ${task.created_at}`);
        console.log('     ---');
      });
    }
    
    console.log('\n✅ Проверка очереди завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке очереди загрузки:', error);
    process.exit(1);
  }
}

checkDownloadQueue();