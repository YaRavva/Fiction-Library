/**
 * Тестовый скрипт для проверки обработки файлов с использованием offsetId
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function testOffsetProcessing() {
  console.log('🔍 Тест обработки файлов с использованием offsetId\n');
  
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
    
    // Получаем ID последнего обработанного сообщения из telegram_processed_messages
    console.log('🔍 Получение ID последнего обработанного сообщения...');
    const { data: lastProcessed, error: lastProcessedError } = await supabase
      .from('telegram_processed_messages')
      .select('message_id')
      .order('processed_at', { ascending: false })
      .limit(1);
    
    if (lastProcessedError) {
      console.log('❌ Ошибка при получении последнего обработанного сообщения:', lastProcessedError.message);
      return;
    }
    
    let lastMessageId: number | null = null;
    if (lastProcessed && lastProcessed.length > 0) {
      const lastMessage = lastProcessed[0];
      lastMessageId = parseInt(lastMessage.message_id, 10);
      console.log(`✅ Последнее обработанное сообщение: ${lastMessageId}`);
    } else {
      console.log('ℹ️  Нет ранее обработанных сообщений');
    }
    
    // Тестируем обработку файлов с лимитом 3
    console.log('\n🚀 Тест обработки 3 файлов с использованием offsetId...');
    const results = await syncService.downloadAndProcessFilesDirectly(3);
    
    console.log(`\n📊 Результаты обработки:`);
    console.log(`   Всего обработано: ${results.length}`);
    
    // Проверяем, что новые сообщения имеют ID меньше последнего обработанного (так как в Telegram сообщения идут от новых к старым)
    for (const result of results) {
      console.log(`   - Message ID: ${result.messageId}`);
      console.log(`     Успешно: ${result.success ? 'Да' : 'Нет'}`);
      console.log(`     Пропущено: ${result.skipped ? 'Да' : 'Нет'}`);
      if (result.filename) console.log(`     Имя файла: ${result.filename}`);
      if (result.error) console.log(`     Ошибка: ${result.error}`);
      if (result.reason) console.log(`     Причина: ${result.reason}`);
      
      // Проверяем порядок сообщений
      if (lastMessageId && typeof result.messageId === 'number') {
        if (result.messageId < lastMessageId) {
          console.log(`     Порядок: ✅ Корректный (ID меньше последнего обработанного)`);
        } else {
          console.log(`     Порядок: ⚠️  Возможно некорректный (ID больше или равен последнему обработанному)`);
        }
      }
      console.log('');
    }
    
    console.log('\n✅ Тест обработки файлов с использованием offsetId завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
testOffsetProcessing().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});