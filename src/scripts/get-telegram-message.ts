import { TelegramService } from '../lib/telegram/client';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function getTelegramMessage(messageId: number) {
  try {
    console.log(`🔍 Получение сообщения из Telegram с ID: ${messageId}`);
    
    // Получаем экземпляр Telegram клиента
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    console.log('📥 Получаем канал с метаданными...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`📡 Канал ID: ${channelId}`);
    
    // Получаем конкретное сообщение по ID
    console.log(`📥 Получаем сообщение с ID: ${messageId}...`);
    const messages = await telegramClient.getMessages(channelId, 1, messageId) as any;
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщение не найдено');
      return;
    }
    
    const message = messages[0];
    console.log('📨 Сообщение найдено:');
    console.log(`  ID: ${message.id}`);
    console.log(`  Текст: ${message.text ? message.text.substring(0, 200) + '...' : 'отсутствует'}`);
    
    if (message.text) {
      // Попробуем извлечь описание из текста
      const descriptionMatch = message.text.match(/Рейтинг:[\s\S]*?\n([\s\S]*?)(?:\n\s*\n|Состав:|$)/i);
      if (descriptionMatch) {
        const description = descriptionMatch[1].trim();
        console.log(`\n📖 Описание из сообщения:`);
        console.log(description);
      } else {
        console.log('\n❌ Не удалось извлечь описание из сообщения');
        console.log('Текст сообщения:');
        console.log(message.text);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Отключаемся от Telegram
    const telegramClient = await TelegramService.getInstance();
    if (telegramClient) {
      await telegramClient.disconnect();
    }
  }
}

// Получаем ID сообщения из аргументов командной строки
const messageIdStr = process.argv[2];
if (!messageIdStr) {
  console.error('❌ Пожалуйста, укажите ID сообщения');
  process.exit(1);
}

const messageId = parseInt(messageIdStr, 10);
if (isNaN(messageId)) {
  console.error('❌ Неверный формат ID сообщения');
  process.exit(1);
}

getTelegramMessage(messageId);