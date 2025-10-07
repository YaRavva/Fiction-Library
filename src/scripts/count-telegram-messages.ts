import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

async function countTelegramMessages() {
  try {
    console.log('🔍 Подсчет количества сообщений в Telegram канале...\n');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем канал с метаданными
    console.log('📡 Получаем канал с метаданными...');
    if (!syncService['telegramClient']) {
      console.error('❌ Не удалось получить доступ к Telegram клиенту');
      return;
    }
    
    const channel = await syncService['telegramClient'].getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`🆔 ID канала: ${channelId}`);
    console.log(`📝 Название канала: ${(channel as { title?: string }).title || 'Неизвестно'}`);
    
    // Получаем сообщения с постепенным подсчетом
    console.log('\n📥 Подсчет сообщений...');
    let totalMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100; // Размер пакета для получения сообщений
    
    while (true) {
      console.log(`   Загружаем пакет сообщений (offsetId: ${offsetId || 'начало'})...`);
      const messages = await syncService['telegramClient'].getMessages(channelId, batchSize, offsetId) as unknown[];
      
      if (messages.length === 0) {
        break;
      }
      
      totalMessages += messages.length;
      console.log(`   Получено ${messages.length} сообщений. Всего: ${totalMessages}`);
      
      // Устанавливаем offsetId для следующего запроса
      // Берем ID последнего сообщения в пакете
      const lastMessage = messages[messages.length - 1] as { id?: number };
      if (lastMessage.id) {
        offsetId = lastMessage.id;
      } else {
        break;
      }
      
      // Добавляем небольшую задержку, чтобы не перегружать Telegram API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Общее количество сообщений в канале: ${totalMessages}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Отключаемся от Telegram
    const syncService = await TelegramSyncService.getInstance();
    await syncService.shutdown();
  }
}

// Если скрипт запущен напрямую, выполняем функцию
if (require.main === module) {
  countTelegramMessages();
}