import { config } from 'dotenv';
import { resolve } from 'path';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Отладочный скрипт для проверки сообщения в Telegram
 * @param messageId ID сообщения для проверки
 */
export async function debugMessage(messageId: number) {
  try {
    console.log(`🔍 Отладка сообщения ${messageId}`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем сообщение из Telegram по ID
    console.log(`📥 Получаем сообщения вокруг ${messageId} из Telegram...`);
    const channel = await (syncService as any).telegramClient.getMetadataChannel();
    if (!channel) {
      throw new Error('Не удалось получить канал');
    }
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
      
    // Получаем несколько сообщений вокруг целевого ID
    const messages: any[] = await (syncService as any).telegramClient.getMessages(channelId, 20, messageId);
    if (!messages || messages.length === 0) {
      console.log(`❌ Сообщения не найдены`);
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Выводим информацию о всех полученных сообщениях
    messages.forEach((msg, index) => {
      const anyMsg = msg as unknown as { [key: string]: unknown };
      console.log(`Сообщение ${index + 1}: ID=${anyMsg.id}`);
    });
    
    // Ищем сообщение с точным совпадением ID
    const targetMessage = messages.find(msg => {
      const anyMsg = msg as unknown as { [key: string]: unknown };
      return anyMsg.id == messageId; // Сравниваем как строки, так как ID могут быть разных типов
    });
    
    if (!targetMessage) {
      console.log(`❌ Сообщение с ID ${messageId} не найдено среди полученных сообщений`);
      return;
    }
    
    const msg = targetMessage;
    const anyMsg = msg as unknown as { [key: string]: unknown };
    
    console.log(`\n✅ Найдено целевое сообщение с ID ${messageId}`);
    console.log(`Текст сообщения:`, anyMsg.message);
    
    // Проверяем наличие текста в сообщении
    if (!anyMsg.message) {
      console.log(`❌ Сообщение не содержит текста`);
      return;
    }
    
    // Парсим текст сообщения
    console.log(`\n📄 Парсинг текста сообщения...`);
    const metadata = MetadataParser.parseMessage(anyMsg.message as string);
    
    console.log(`Результат парсинга:`, metadata);
    
    // Проверяем, есть ли описание в метаданных
    if (!metadata.description || metadata.description.trim() === '') {
      console.log(`ℹ️ Описание не найдено в сообщении`);
    } else {
      console.log(`✅ Описание найдено: ${metadata.description.substring(0, 100)}...`);
    }
  } catch (error) {
    console.error('❌ Ошибка отладки сообщения:', error);
  }
}

// Если скрипт запущен напрямую, выполняем отладку
if (require.main === module) {
  const messageId = parseInt(process.argv[2] || '4578');
  debugMessage(messageId)
    .then(() => {
      console.log('🔒 Скрипт завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      process.exit(1);
    });
}