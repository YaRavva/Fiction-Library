import { config } from 'dotenv';
import { serverSupabase } from '@/lib/serverSupabase';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Скрипт для очистки очередей загрузки файлов
 * 
 * Использование:
 * npx tsx src/scripts/clear-download-queues.ts
 */

async function clearDownloadQueues() {
  console.log('🗑️ Очистка очередей загрузки файлов...\n');
  
  try {
    // Очищаем таблицу telegram_download_queue
    console.log('Очистка telegram_download_queue...');
    const { error: error1 } = await serverSupabase
      .from('telegram_download_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Условие, которое всегда истинно
    
    if (error1) {
      console.error('❌ Ошибка очистки telegram_download_queue:', error1);
      return;
    }
    console.log('✅ telegram_download_queue очищена\n');
    
    // Очищаем таблицу download_queue
    console.log('Очистка download_queue...');
    const { error: error2 } = await serverSupabase
      .from('download_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Условие, которое всегда истинно
    
    if (error2) {
      console.error('❌ Ошибка очистки download_queue:', error2);
      return;
    }
    console.log('✅ download_queue очищена\n');
    
    console.log('✅ Все очереди успешно очищены!');
  } catch (error) {
    console.error('❌ Ошибка при очистке очередей:', error);
    process.exit(1);
  }
}

// Выполняем очистку
clearDownloadQueues();