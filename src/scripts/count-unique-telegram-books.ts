/**
 * Script to count unique books in Telegram channel
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Load environment variables FIRST
config({ path: '.env.local' });
config({ path: '.env' });

async function countUniqueTelegramBooks() {
  try {
    console.log('🔍 Подсчет уникальных книг в Telegram канале\n');
    
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
    console.log(`📝 Название канала: ${(channel as any).title || 'Неизвестно'}`);
    
    // Get all books from database for comparison
    console.log('\n📚 Получение книг из базы данных для сравнения...');
    const { data: existingBooks, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id');
    
    if (booksError) {
      throw new Error(`Error fetching books from database: ${booksError.message}`);
    }
    
    console.log(`   Загружено ${existingBooks?.length || 0} книг из базы данных`);
    
    // Create a map of existing books for quick lookup
    const existingBooksMap = new Map<string, any>();
    existingBooks?.forEach(book => {
      const key = `${book.author}|${book.title}`;
      existingBooksMap.set(key, book);
    });
    
    // Get messages from Telegram channel and analyze them
    console.log('\n🔍 Анализ сообщений Telegram...');
    
    let totalMessages = 0;
    let bookMessages = 0;
    let uniqueBooksInTelegram = 0;
    let newBooksFound = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100;
    const bookSet = new Set<string>(); // To track unique books in Telegram
    
    while (true) {
      console.log(`   Обработка пакета сообщений (всего обработано: ${totalMessages})...`);
      const messages = await telegramClient.getMessages(channelId, batchSize, offsetId) as any[];
      
      if (messages.length === 0) {
        break;
      }
      
      totalMessages += messages.length;
      
      // Process each message
      for (const message of messages) {
        if (message.text) {
          try {
            // Try to parse message as book metadata
            const metadata = MetadataParser.parseMessage(message.text);
            
            // Check if it looks like a book (has author and title)
            if (metadata.author && metadata.title) {
              bookMessages++;
              const bookKey = `${metadata.author}|${metadata.title}`;
              
              // Add to set of unique books
              if (!bookSet.has(bookKey)) {
                bookSet.add(bookKey);
                uniqueBooksInTelegram++;
                
                // Check if this book already exists in database
                if (!existingBooksMap.has(bookKey)) {
                  newBooksFound++;
                }
              }
            }
          } catch (parseError) {
            // Not a book message, skip
          }
        }
      }
      
      console.log(`     Обработано: ${messages.length} сообщений, найдено книг: ${bookMessages}`);
      
      // Set offsetId for next batch
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id) {
        offsetId = lastMessage.id;
      } else {
        break;
      }
      
      // Add delay to avoid overwhelming Telegram API
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Results
    console.log('\n📊 РЕЗУЛЬТАТЫ АНАЛИЗА:');
    console.log(`   ========================================`);
    console.log(`   Всего сообщений в канале: ${totalMessages}`);
    console.log(`   Сообщений с книгами: ${bookMessages}`);
    console.log(`   Уникальных книг в Telegram: ${uniqueBooksInTelegram}`);
    console.log(`   Новых книг (еще не в базе): ${newBooksFound}`);
    console.log(`   Книг уже в базе данных: ${uniqueBooksInTelegram - newBooksFound}`);
    
    // Compare with database
    console.log('\n📚 СРАВНЕНИЕ С БАЗОЙ ДАННЫХ:');
    console.log(`   ========================================`);
    console.log(`   Книг в базе данных: ${existingBooks?.length || 0}`);
    console.log(`   Уникальных книг в базе: ${existingBooksMap.size}`);
    
    // Close Telegram client
    await telegramClient.disconnect();
    console.log('\n✅ Анализ завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при подсчете уникальных книг:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  countUniqueTelegramBooks();
}