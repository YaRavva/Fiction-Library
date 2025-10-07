import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';
import { MetadataParser } from '../lib/telegram/parser';

// Загружаем переменные окружения из .env файла
config();

async function analyzeSkippedMessages() {
  try {
    console.log('🔍 Анализ пропущенных сообщений при синхронизации...\n');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    if (!syncService['telegramClient']) {
      console.error('❌ Не удалось получить доступ к Telegram клиенту');
      return;
    }
    
    // Получаем канал с метаданными
    console.log('📡 Получаем канал с метаданными...');
    const channel = await syncService['telegramClient'].getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    console.log(`🆔 ID канала: ${channelId}`);
    console.log(`📝 Название канала: ${(channel as { title?: string }).title || 'Неизвестно'}`);
    
    // Получаем небольшой набор сообщений для анализа
    console.log('\n📥 Получаем сообщения для анализа...');
    const messages = await syncService['telegramClient'].getMessages(channelId, 50) as unknown[];
    
    console.log(`✅ Получено ${messages.length} сообщений для анализа\n`);
    
    // Анализируем сообщения
    let validBookMessages = 0;
    let invalidBookMessages = 0;
    let noTextMessages = 0;
    let emptyTextMessages = 0;
    
    for (const msg of messages) {
      const anyMsg = msg as { [key: string]: unknown };
      console.log(`📝 Сообщение ID: ${anyMsg.id}`);
      
      // Проверяем наличие текста
      if (!(msg as { text?: string }).text) {
        console.log(`  ℹ️ Сообщение не содержит текста`);
        noTextMessages++;
        continue;
      }
      
      const text = (msg as { text: string }).text;
      if (text.trim() === '') {
        console.log(`  ℹ️ Сообщение содержит пустой текст`);
        emptyTextMessages++;
        continue;
      }
      
      // Пытаемся распарсить метаданные
      try {
        const metadata = MetadataParser.parseMessage(text);
        
        // Проверяем, есть ли у книги название и автор
        if (metadata.title && metadata.author) {
          console.log(`  ✅ Найдена книга: ${metadata.author} - ${metadata.title}`);
          validBookMessages++;
        } else {
          console.log(`  ⚠️ Неполные метаданные: ${metadata.title || 'нет названия'} / ${metadata.author || 'нет автора'}`);
          invalidBookMessages++;
        }
      } catch (parseError) {
        console.log(`  ❌ Ошибка парсинга: ${(parseError as Error).message}`);
        invalidBookMessages++;
      }
      
      console.log('');
    }
    
    // Выводим сводку
    console.log('📊 Сводка анализа:');
    console.log(`   ✅ Сообщений с корректными метаданными книг: ${validBookMessages}`);
    console.log(`   ⚠️ Сообщений с некорректными метаданными: ${invalidBookMessages}`);
    console.log(`   ℹ️ Сообщений без текста: ${noTextMessages}`);
    console.log(`   ℹ️ Сообщений с пустым текстом: ${emptyTextMessages}`);
    console.log(`   📚 Всего проанализировано сообщений: ${messages.length}`);
    
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
  analyzeSkippedMessages();
}