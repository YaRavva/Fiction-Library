import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

dotenv.config();

async function clearTelegramFileId() {
  try {
    console.log('🔍 Очистка поля telegram_file_id в таблице telegram_processed_messages...');
    
    // Обновляем все записи, устанавливая telegram_file_id в null
    const { error } = await serverSupabase
      .from('telegram_processed_messages')
      .update({ telegram_file_id: null })
      .neq('telegram_file_id', null);
    
    if (error) {
      console.error('❌ Ошибка при очистке поля telegram_file_id:', error);
      process.exit(1);
    }
    
    console.log('✅ Поле telegram_file_id очищено во всех записях');
    console.log('✅ Очистка завершена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
  }
}

clearTelegramFileId();