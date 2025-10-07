/**
 * Script to check unprocessed Telegram messages and estimate real book count
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables FIRST
config({ path: '.env.local' });
config({ path: '.env' });

async function checkUnprocessedMessages() {
  try {
    console.log('🔍 Анализ необработанных сообщений Telegram\n');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Initialize Telegram client
    console.log('🔐 Подключение к Telegram...');
    const telegramClient = await TelegramService.getInstance();
    console.log('✅ Подключение к Telegram установлено');
    
    // Get metadata channel
    console.log('📡 Получение канала с метаданными...');
    const channel = await telegramClient.getMetadataChannel();
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
        
    console.log(`🆔 ID канала: ${channelId}`);
    
    // Get total message count in channel by iterating through messages
    console.log('\n📊 Получение общего количества сообщений в канале...');
    let totalMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100; // Размер пакета для получения сообщений
    let batchCount = 0;
    
    while (true) {
      batchCount++;
      console.log(`   Загружаем пакет ${batchCount} сообщений (offsetId: ${offsetId || 'начало'})...`);
      const messages = await telegramClient.getMessages(channelId, batchSize, offsetId) as unknown[];
      
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
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`   Всего сообщений в канале: ${totalMessages}`);
    
    // Get processed messages from database
    console.log('\n📂 Получение обработанных сообщений из базы данных...');
    const { count: processedMessages, error: processedError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
    
    if (processedError) {
      throw new Error(`Error counting processed messages: ${processedError.message}`);
    }
    
    console.log(`   Обработанных сообщений: ${processedMessages}`);
    
    // Calculate unprocessed messages
    const unprocessedMessages = totalMessages - (processedMessages || 0);
    console.log(`   Необработанных сообщений: ${unprocessedMessages}`);
    
    // Estimate potential books
    console.log('\n📈 Оценка потенциального количества книг...');
    
    // Get ratio of messages that contain books from processed data
    const { data: sampleMessages, error: sampleError } = await supabase
      .from('telegram_processed_messages')
      .select('message_id, book_id')
      .limit(100);
    
    if (sampleError) {
      throw new Error(`Error fetching sample messages: ${sampleError.message}`);
    }
    
    // Count messages that are linked to books
    const messagesWithBooks = sampleMessages?.filter(msg => msg.book_id !== null).length || 0;
    const sampleSize = sampleMessages?.length || 1;
    const bookRatio = messagesWithBooks / sampleSize;
    
    console.log(`   Проанализировано сообщений для оценки: ${sampleSize}`);
    console.log(`   Сообщений со связанными книгами: ${messagesWithBooks}`);
    console.log(`   Процент сообщений со связанными книгами: ${(bookRatio * 100).toFixed(2)}%`);
    
    // Estimate total potential books
    const estimatedTotalBooks = Math.round(totalMessages * bookRatio);
    const estimatedUnprocessedBooks = estimatedTotalBooks - (processedMessages || 0);
    
    console.log(`\n📊 Оценка общего количества книг: ${estimatedTotalBooks}`);
    console.log(`   Оценка необработанных книг: ${estimatedUnprocessedBooks}`);
    
    // Current database stats
    console.log('\n📚 Текущая статистика базы данных:');
    const { count: totalBooks, error: totalBooksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (totalBooksError) {
      throw new Error(`Error counting total books: ${totalBooksError.message}`);
    }
    
    console.log(`   Всего книг в базе данных: ${totalBooks}`);
    
    const { count: booksWithFiles, error: filesError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('file_url', 'is', null);
    
    if (filesError) {
      throw new Error(`Error counting books with files: ${filesError.message}`);
    }
    
    console.log(`   Книг с загруженными файлами: ${booksWithFiles}`);
    
    // Summary
    console.log('\n📋 СВОДКА:');
    console.log(`   ========================================`);
    console.log(`   Всего сообщений в канале: ${totalMessages}`);
    console.log(`   Обработанных сообщений: ${processedMessages}`);
    console.log(`   Необработанных сообщений: ${unprocessedMessages}`);
    console.log(`   Процент сообщений со связанными книгами: ${(bookRatio * 100).toFixed(2)}%`);
    console.log(`   Оценка общего количества книг: ${estimatedTotalBooks}`);
    console.log(`   Оценка необработанных книг: ${estimatedUnprocessedBooks}`);
    console.log(`   Книг в базе данных: ${totalBooks}`);
    console.log(`   Книг с загруженными файлами: ${booksWithFiles}`);
    
    // Close Telegram client
    await telegramClient.disconnect();
    console.log('\n✅ Анализ завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при анализе необработанных сообщений:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  checkUnprocessedMessages();
}