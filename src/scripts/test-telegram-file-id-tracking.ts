/**
 * Тестовый скрипт для проверки отслеживания telegram_file_id в таблице telegram_processed_messages
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function testTelegramFileIdTracking() {
  console.log('🧪 Тестирование отслеживания telegram_file_id в telegram_processed_messages\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Получаем экземпляр сервиса синхронизации
    console.log('1️⃣  Инициализация сервиса синхронизации...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('    ✅ Сервис синхронизации инициализирован\n');
    
    // Тестируем загрузку одного файла
    console.log('2️⃣  Загрузка одного файла...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    
    if (results.length > 0) {
      const result = results[0];
      if (result.success) {
        console.log(`    ✅ Файл успешно загружен: ${result.filename}`);
        console.log(`    🆔 Message ID: ${result.messageId}`);
        
        // Проверяем запись в telegram_processed_messages
        console.log('\n3️⃣  Проверка записи в telegram_processed_messages...');
        const { data, error } = await supabase
          .from('telegram_processed_messages')
          .select('*')
          .eq('message_id', String(result.messageId))
          .single();
          
        if (error) {
          console.error('    ❌ Ошибка при получении записи:', error);
        } else if (data) {
          console.log('    ✅ Найдена запись в telegram_processed_messages:');
          console.log(`       ID: ${data.id}`);
          console.log(`       Message ID: ${data.message_id}`);
          console.log(`       Telegram File ID: ${data.telegram_file_id}`);
          console.log(`       Processed At: ${data.processed_at}`);
          
          if (data.telegram_file_id === String(result.messageId)) {
            console.log('    🎉 telegram_file_id успешно записан в таблицу!');
          } else {
            console.log('    ⚠️  telegram_file_id не совпадает с message_id');
          }
        }
      } else {
        console.log('    ❌ Ошибка при загрузке файла:', result.error);
      }
    } else {
      console.log('    ⚠️  Нет файлов для обработки');
    }
    
    console.log('\n✅ Тестирование завершено успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск скрипта
testTelegramFileIdTracking().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});