import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import dotenv from 'dotenv';

dotenv.config();

async function getAllMetadata() {
  console.log('🔍 Getting all book metadata from Telegram channel...');
  
  try {
    // Инициализируем Telegram клиент
    console.log('\n📱 Initializing Telegram client...');
    const telegramService = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    console.log('📡 Getting metadata channel...');
    const channel = await telegramService.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ?
        (channel.id as { toString: () => string }).toString() :
        String(channel.id);
    
    console.log(`✅ Connected to channel ID: ${channelId}`);
    
    // Получаем все сообщения из канала
    console.log('\n📥 Getting all messages from channel...');
    const allMessages = await telegramService.getAllMessages(channelId, 100);
    
    console.log(`✅ Retrieved ${allMessages.length} messages`);
    
    // Обрабатываем сообщения и извлекаем метаданные
    console.log('\n📝 Processing messages and extracting metadata...');
    const metadataList: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const message of allMessages) {
      try {
        // Извлекаем текст сообщения
        let messageText = '';
        if (message && typeof message === 'object') {
          if ('message' in message && message.message && typeof message.message === 'string') {
            messageText = message.message;
          } else if ('text' in message && message.text && typeof message.text === 'string') {
            messageText = message.text;
          }
        }
        
        // @ts-ignore
        const messageId = message.id;
        
        if (!messageText) {
          console.log(`⚠️ Message ${messageId} does not contain any text. Skipping.`);
          skippedCount++;
          continue;
        }
        
        // Парсим метаданные из сообщения
        const metadata = MetadataParser.parseMessage(messageText);
        
        // Проверяем, есть ли у нас автор и название
        if (!metadata.author || !metadata.title) {
          console.log(`⚠️ Message ${messageId} is missing author or title. Skipping.`);
          skippedCount++;
          continue;
        }
        
        // Добавляем ID сообщения к метаданным
        metadata.messageId = messageId;
        
        metadataList.push(metadata);
        processedCount++;
        
        // Показываем прогресс каждые 50 сообщений
        if (processedCount % 50 === 0) {
          console.log(`📊 Progress: ${processedCount} messages processed`);
        }
        
      } catch (error) {
        // @ts-ignore
        console.error(`❌ Error processing message ${message.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📈 === PROCESSING RESULTS ===');
    console.log(`✅ Successfully processed: ${processedCount} messages`);
    console.log(`⏭️ Skipped messages: ${skippedCount}`);
    console.log(`❌ Messages with errors: ${errorCount}`);
    console.log(`📚 Total books extracted: ${metadataList.length}`);
    
    // Показываем примеры извлеченных метаданных
    console.log('\n📋 Sample of extracted metadata:');
    for (let i = 0; i < Math.min(5, metadataList.length); i++) {
      const metadata = metadataList[i];
      console.log(`\n--- Book ${i + 1} ---`);
      console.log(`  ID: ${metadata.messageId}`);
      console.log(`  Author: ${metadata.author}`);
      console.log(`  Title: ${metadata.title}`);
      if (metadata.series) {
        console.log(`  Series: ${metadata.series}`);
      }
      if (metadata.genres.length > 0) {
        console.log(`  Genres: ${metadata.genres.join(', ')}`);
      }
      if (metadata.tags.length > 0) {
        console.log(`  Tags: ${metadata.tags.join(', ')}`);
      }
      console.log(`  Rating: ${metadata.rating}`);
      if (metadata.description) {
        console.log(`  Description: ${metadata.description.substring(0, 100)}...`);
      }
      if (metadata.books.length > 0) {
        console.log(`  Books in series: ${metadata.books.length}`);
      }
    }
    
    // Сохраняем метаданные в JSON файл
    console.log('\n💾 Saving metadata to file...');
    const fs = require('fs');
    const path = require('path');
    
    const outputPath = path.join(__dirname, '..', '..', 'output', 'all-metadata.json');
    const outputDir = path.dirname(outputPath);
    
    // Создаем директорию output, если она не существует
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Сохраняем данные в файл
    fs.writeFileSync(outputPath, JSON.stringify(metadataList, null, 2), 'utf8');
    console.log(`✅ Metadata saved to: ${outputPath}`);
    
    console.log('\n✅ Metadata extraction completed successfully');
    
  } catch (error) {
    console.error('❌ Error during metadata extraction:', error);
  } finally {
    // Отключаем Telegram клиент
    try {
      const telegramService = await TelegramService.getInstance();
      await telegramService.disconnect();
      console.log('📱 Telegram client disconnected');
    } catch (disconnectError) {
      console.error('⚠️  Error disconnecting Telegram client:', disconnectError);
    }
  }
}

// Run the script
getAllMetadata().catch(console.error);