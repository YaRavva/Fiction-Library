import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

async function testMessageRetrieval() {
  try {
    console.log('🔍 Тестирование получения сообщений из канала "Архив для фантастики"\n');
    
    // Initialize Telegram client
    console.log('🔐 Подключение к Telegram...');
    const telegramClient = await TelegramService.getInstance();
    console.log('✅ Подключение к Telegram установлено');
    
    // Get files channel
    console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
    const channel = await telegramClient.getFilesChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
        
    console.log(`🆔 ID канала: ${channelId}`);
    console.log(`📝 Название канала: ${(channel as any).title || 'Неизвестно'}`);
    
    // Test getting a specific message by ID
    const testMessageId = 4379; // Пример ID сообщения из логов
    console.log(`\n📥 Получаем сообщение с ID: ${testMessageId}...`);
    
    // @ts-ignore
    const messages: any[] = await telegramClient.client.getMessages(channel, { ids: [testMessageId] });
    
    if (!messages || messages.length === 0) {
      console.log(`❌ Сообщение с ID ${testMessageId} не найдено`);
    } else {
      const message = messages[0];
      console.log(`✅ Сообщение найдено:`);
      console.log(`   ID: ${message.id}`);
      console.log(`   Дата: ${message.date}`);
      
      if (message.media) {
        console.log(`   Медиа: Да`);
        console.log(`   Тип медиа: ${(message.media as any).className || 'Неизвестно'}`);
      } else {
        console.log(`   Медиа: Нет`);
      }
      
      if (message.document) {
        console.log(`   Документ: Да`);
        if (message.document.attributes) {
          const filenameAttr = (message.document.attributes as any[]).find(
            (attr: any) => attr.className === 'DocumentAttributeFilename'
          );
          if (filenameAttr && filenameAttr.fileName) {
            console.log(`   Имя файла: ${filenameAttr.fileName}`);
          }
        }
      }
    }
    
    // Test getting multiple messages
    console.log('\n📥 Получаем последние 5 сообщений...');
    const recentMessages = await telegramClient.getMessages(channelId, 5) as any[];
    
    console.log(`✅ Получено ${recentMessages.length} сообщений:`);
    recentMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ID: ${msg.id}, Дата: ${msg.date}`);
      if (msg.document) {
        if (msg.document.attributes) {
          const filenameAttr = (msg.document.attributes as any[]).find(
            (attr: any) => attr.className === 'DocumentAttributeFilename'
          );
          if (filenameAttr && filenameAttr.fileName) {
            console.log(`      Файл: ${filenameAttr.fileName}`);
          }
        }
      }
    });
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании получения сообщений:', error);
    process.exit(1);
  }
}

testMessageRetrieval();