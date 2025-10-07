/**
 * Quick script to get Telegram stats without loading all messages
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { TelegramService } from '../lib/telegram/client';
import { Api } from 'telegram';

// Load environment variables FIRST
config({ path: '.env.local' });
config({ path: '.env' });

async function quickTelegramStats() {
  try {
    console.log('🔍 Быстрый анализ статистики Telegram\n');
    
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
    
    // Try to get dialog info for quick message count
    console.log('\n📊 Получение информации о диалоге...');
    try {
      // @ts-ignore
      const dialogs = await telegramClient.client.getDialogs();
      const targetDialog = dialogs.find((dialog: any) => {
        // @ts-ignore
        return dialog.entity && dialog.entity.id && dialog.entity.id.toString() === channelId;
      });
      
      if (targetDialog) {
        // @ts-ignore
        console.log(`   Всего сообщений в канале (из диалога): ${targetDialog.unreadCount || 'неизвестно'}`);
      } else {
        console.log('   Информация о диалоге не найдена');
      }
    } catch (dialogError) {
      console.log('   Не удалось получить информацию о диалоге:', (dialogError as Error).message);
    }
    
    // Get a few messages to estimate density
    console.log('\n🔍 Получение небольшой выборки сообщений для оценки...');
    const sampleMessages = await telegramClient.getMessages(channelId, 50) as any[];
    console.log(`   Получено ${sampleMessages.length} сообщений для анализа`);
    
    // Analyze message IDs to understand the range
    if (sampleMessages.length > 0) {
      const messageIds = sampleMessages
        .filter(msg => msg.id)
        .map(msg => msg.id)
        .sort((a, b) => a - b);
      
      if (messageIds.length > 0) {
        const minId = messageIds[0];
        const maxId = messageIds[messageIds.length - 1];
        console.log(`   Минимальный ID сообщения в выборке: ${minId}`);
        console.log(`   Максимальный ID сообщения в выборке: ${maxId}`);
        console.log(`   Разница в ID: ${maxId - minId}`);
      }
    }
    
    // Get processed messages from database
    console.log('\n📂 Получение обработанных сообщений из базы данных...');
    const { count: processedMessages, error: processedError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
    
    if (processedError) {
      throw new Error(`Error counting processed messages: ${processedError.message}`);
    }
    
    console.log(`   Обработанных сообщений: ${processedMessages}`);
    
    // Get current database stats
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
    console.log(`   Книг в базе данных: ${totalBooks}`);
    console.log(`   Книг с загруженными файлами: ${booksWithFiles}`);
    console.log(`   Обработанных сообщений Telegram: ${processedMessages}`);
    
    // Close Telegram client
    await telegramClient.disconnect();
    console.log('\n✅ Анализ завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при быстром анализе Telegram:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  quickTelegramStats();
}