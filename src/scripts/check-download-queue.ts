import { config } from 'dotenv';
import { serverSupabase } from '@/lib/serverSupabase';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Скрипт для проверки статуса очереди загрузки файлов
 * 
 * Использование:
 * npx tsx src/scripts/check-download-queue.ts
 */

async function checkDownloadQueue() {
  try {
    console.log('🔍 Проверка статуса очереди загрузки файлов...\n');

    // Получаем все задачи и группируем по статусам вручную
    const { data: allTasks, error: allTasksError } = await serverSupabase
      .from('telegram_download_queue')
      .select('status');

    if (allTasksError) {
      console.error('❌ Ошибка при получении задач:', allTasksError);
      process.exit(1);
    }

    // Группируем задачи по статусам
    const statusStats: Record<string, number> = {};
    if (allTasks) {
      allTasks.forEach((task: any) => {
        statusStats[task.status] = (statusStats[task.status] || 0) + 1;
      });
    }

    console.log('📊 Статистика по статусам:');
    if (Object.keys(statusStats).length > 0) {
      Object.entries(statusStats).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    } else {
      console.log('  Нет данных');
    }

    console.log('\n📥 Ожидающие задачи (первые 10):');
    const { data: pendingTasks, error: pendingError } = await serverSupabase
      .from('telegram_download_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (pendingError) {
      console.error('❌ Ошибка при получении ожидающих задач:', pendingError);
      process.exit(1);
    }

    if (pendingTasks && pendingTasks.length > 0) {
      pendingTasks.forEach((task: any) => {
        console.log(`  ID: ${task.id}`);
        console.log(`    Message ID: ${task.message_id}`);
        console.log(`    Channel ID: ${task.channel_id}`);
        console.log(`    Created: ${task.created_at}`);
        console.log(`    Priority: ${task.priority}`);
        console.log('  ---');
      });
    } else {
      console.log('  Нет ожидающих задач');
    }

    console.log('\n⚙️  Задачи в процессе (первые 10):');
    const { data: processingTasks, error: processingError } = await serverSupabase
      .from('telegram_download_queue')
      .select('*')
      .eq('status', 'processing')
      .order('started_at', { ascending: true })
      .limit(10);

    if (processingError) {
      console.error('❌ Ошибка при получении задач в процессе:', processingError);
      process.exit(1);
    }

    if (processingTasks && processingTasks.length > 0) {
      processingTasks.forEach((task: any) => {
        console.log(`  ID: ${task.id}`);
        console.log(`    Message ID: ${task.message_id}`);
        console.log(`    Channel ID: ${task.channel_id}`);
        console.log(`    Started: ${task.started_at}`);
        console.log('  ---');
      });
    } else {
      console.log('  Нет задач в процессе');
    }

    console.log('\n✅ Проверка очереди завершена');
  } catch (error) {
    console.error('❌ Ошибка при проверке очереди:', error);
    process.exit(1);
  }
}

// Выполняем проверку очереди
checkDownloadQueue();