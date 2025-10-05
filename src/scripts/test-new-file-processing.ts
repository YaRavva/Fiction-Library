/**
 * Тестовый скрипт для проверки обработки новых файлов
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function testNewFileProcessing() {
  console.log('🔍 Тест обработки новых файлов\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем экземпляр сервиса синхронизации
    console.log('🔧 Получение экземпляра сервиса синхронизации...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Сервис синхронизации получен\n');
    
    // Тестируем обработку файлов с лимитом 2 (чтобы получить новый файл)
    console.log('🚀 Тест обработки 2 файлов...');
    const results = await syncService.downloadAndProcessFilesDirectly(2);
    
    console.log(`\n📊 Результаты обработки:`);
    console.log(`   Всего обработано: ${results.length}`);
    
    for (const result of results) {
      console.log(`   - Message ID: ${result.messageId}`);
      console.log(`     Успешно: ${result.success ? 'Да' : 'Нет'}`);
      console.log(`     Пропущено: ${result.skipped ? 'Да' : 'Нет'}`);
      if (result.filename) console.log(`     Имя файла: ${result.filename}`);
      if (result.error) console.log(`     Ошибка: ${result.error}`);
      if (result.reason) console.log(`     Причина: ${result.reason}`);
      console.log('');
    }
    
    // Проверяем записи в telegram_processed_messages для обработанных сообщений
    for (const result of results) {
      if (result.messageId && !result.skipped) {
        console.log(`🔍 Проверка записи в telegram_processed_messages для message_id = ${result.messageId}...`);
        const { data: processedMessages, error: processedMessagesError } = await supabase
          .from('telegram_processed_messages')
          .select('*')
          .eq('message_id', String(result.messageId));
          
        if (processedMessagesError) {
          console.log('❌ Ошибка при поиске записей:', processedMessagesError.message);
        } else if (processedMessages && processedMessages.length > 0) {
          console.log(`✅ Найдена запись для message_id = ${result.messageId}:`);
          const msg = processedMessages[0];
          console.log(`   ID записи: ${msg.id}`);
          console.log(`   Book ID: ${msg.book_id}`);
          console.log(`   Telegram File ID: ${msg.telegram_file_id}`);
          console.log(`   Processed At: ${msg.processed_at}`);
        } else {
          console.log(`❌ Запись для message_id = ${result.messageId} не найдена`);
        }
        console.log('');
      }
    }
    
    console.log('\n✅ Тест обработки новых файлов завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
testNewFileProcessing().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});