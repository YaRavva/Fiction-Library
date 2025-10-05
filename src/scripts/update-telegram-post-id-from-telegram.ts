import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function updateTelegramPostIdFromTelegram() {
  try {
    console.log('🚀 Начинаем обновление telegram_post_id из Telegram...');
    
    // Получаем клиент Supabase
    const { getSupabaseAdmin } = await import('../lib/supabase');
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем экземпляр сервиса синхронизации Telegram
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем записи с пустым или UNKNOWN telegram_post_id
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id, title, author')
      .or('telegram_post_id.is.null,telegram_post_id.eq.,telegram_post_id.eq.UNKNOWN')
      .limit(100); // Ограничиваем для тестирования
    
    if (fetchError) {
      throw new Error(`Ошибка получения записей: ${fetchError.message}`);
    }
    
    if (!books || books.length === 0) {
      console.log('ℹ️ Нет записей для обновления');
      return;
    }
    
    console.log(`📊 Найдено ${books.length} записей для обновления`);
    
    // Получаем канал с метаданными
    console.log('📡 Получаем канал с метаданными...');
    const channel = await (syncService as any).telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем большое количество сообщений из Telegram (например, 1000)
    console.log('📥 Получаем сообщения из Telegram...');
    const messages: any[] = await (syncService as any).telegramClient.getMessages(channelId, 1000);
    
    console.log(`✅ Получено ${messages.length} сообщений из Telegram`);
    
    // Создаем карту сообщений по названию и автору
    const messageMap = new Map<string, number>();
    
    for (const msg of messages) {
      const anyMsg = msg as unknown as { [key: string]: unknown };
      
      // Проверяем наличие текста в сообщении
      if (!(msg as { text?: string }).text) {
        continue;
      }
      
      // Парсим текст сообщения
      const metadata = MetadataParser.parseMessage((msg as { text: string }).text);
      
      // Создаем ключ для поиска
      const key = `${metadata.author}|${metadata.title}`;
      messageMap.set(key, anyMsg.id as number);
    }
    
    console.log(`📊 Создана карта из ${messageMap.size} сообщений`);
    
    // Обновляем записи в базе данных
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const book of books) {
      // Создаем ключ для поиска
      const key = `${book.author}|${book.title}`;
      
      // Ищем сообщение в карте
      const messageId = messageMap.get(key);
      
      if (messageId) {
        // Обновляем запись
        const { error: updateError } = await supabase
          .from('books')
          .update({
            telegram_post_id: String(messageId)
          })
          .eq('id', book.id);
        
        if (updateError) {
          console.error(`❌ Ошибка обновления записи ${book.id}: ${updateError.message}`);
        } else {
          console.log(`✅ Обновлена запись: ${book.author} - ${book.title} -> ${messageId}`);
          updatedCount++;
        }
      } else {
        console.log(`⚠️  Не найдено сообщение для: ${book.author} - ${book.title}`);
        notFoundCount++;
      }
    }
    
    console.log(`\n📊 Результаты обновления:`);
    console.log(`  Успешно обновлено: ${updatedCount}`);
    console.log(`  Не найдено сообщений: ${notFoundCount}`);
    console.log(`  Всего обработано: ${books.length}`);
    
  } catch (error) {
    console.error('❌ Ошибка обновления telegram_post_id:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

// Если скрипт запущен напрямую, выполняем обновление
if (require.main === module) {
  updateTelegramPostIdFromTelegram()
    .then(() => {
      // Принудительно завершаем процесс через 1 секунду
      setTimeout(() => {
        console.log('🔒 Скрипт принудительно завершен');
        process.exit(0);
      }, 1000);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      // Принудительно завершаем процесс и в случае ошибки
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
}

export { updateTelegramPostIdFromTelegram };