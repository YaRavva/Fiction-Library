import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Функция для подсчета уникальных книг в Telegram
async function countUniqueBooksInTelegram(telegramClient: TelegramService, channel: any): Promise<number> {
  try {
    console.log('Counting unique books in Telegram channel...');
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    // Получаем все книги из базы данных для сравнения
    console.log('Fetching existing books from database for comparison...');
    const { data: existingBooks, error: booksError } = await supabaseAdmin
      .from('books')
      .select('id, title, author');
    
    if (booksError) {
      console.error(`Error fetching books from database: ${booksError.message}`);
      throw new Error(`Error fetching books from database: ${booksError.message}`);
    }
    
    console.log(`Loaded ${existingBooks?.length || 0} books from database`);
    
    // Создаем карту существующих книг для быстрого поиска
    const existingBooksMap = new Map<string, any>();
    existingBooks?.forEach(book => {
      const key = `${book.author}|${book.title}`;
      existingBooksMap.set(key, book);
    });
    
    // Получаем сообщения из Telegram канала и анализируем их
    console.log('Analyzing messages from Telegram channel...');
    
    let totalMessages = 0;
    let bookMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100;
    const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
    
    while (true) {
      console.log(`Processing batch of messages (total processed: ${totalMessages})...`);
      const messages = await telegramClient.getMessages(channelId, batchSize, offsetId) as any[];
      
      if (messages.length === 0) {
        break;
      }
      
      totalMessages += messages.length;
      
      // Обрабатываем каждое сообщение
      for (const message of messages) {
        if (message.text) {
          try {
            // Пытаемся распарсить сообщение как метаданные книги
            const metadata = MetadataParser.parseMessage(message.text);
            
            // Проверяем, выглядит ли это как книга (есть автор и название)
            if (metadata.author && metadata.title) {
              bookMessages++;
              const bookKey = `${metadata.author}|${metadata.title}`;
              
              // Добавляем в набор уникальных книг
              if (!bookSet.has(bookKey)) {
                bookSet.add(bookKey);
              }
            }
          } catch (parseError) {
            // Не сообщение с книгой, пропускаем
          }
        }
      }
      
      console.log(`  Processed: ${messages.length} messages, found books: ${bookMessages}`);
      
      // Устанавливаем offsetId для следующей партии
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id) {
        offsetId = lastMessage.id;
      } else {
        break;
      }
      
      // Добавляем задержку, чтобы не перегружать Telegram API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Total unique books in Telegram: ${bookSet.size}`);
    return bookSet.size;
    
  } catch (error) {
    console.error('Error counting unique books in Telegram:', error);
    throw error;
  }
}

async function updateTelegramStats() {
  try {
    console.log('🚀 Начало обновления статистики Telegram\n');
    
    // Получаем количество книг в базе данных
    let booksInDatabase = 0;
    try {
      console.log('Получение количества книг в базе данных...');
      const { count, error: booksCountError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true });

      if (booksCountError) {
        console.error(`Ошибка при подсчете книг в базе данных: ${booksCountError.message}`);
      } else {
        booksInDatabase = count || 0;
      }
      console.log(`Книг в базе данных: ${booksInDatabase}`);
    } catch (error: unknown) {
      console.error('Ошибка при подсчете книг в базе данных:', error);
    }

    // Получаем количество книг без файлов
    let booksWithoutFiles = 0;
    try {
      console.log('Получение количества книг без файлов...');
      const { count, error: booksWithoutFilesError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true })
        .is('file_url', null);

      if (booksWithoutFilesError) {
        console.error(`Ошибка при подсчете книг без файлов: ${booksWithoutFilesError.message}`);
      } else {
        booksWithoutFiles = count || 0;
      }
      console.log(`Книг без файлов: ${booksWithoutFiles}`);
    } catch (error: unknown) {
      console.error('Ошибка при подсчете книг без файлов:', error);
    }

    // Получаем количество уникальных книг в Telegram канале
    let booksInTelegram = 0;
    try {
      console.log('Получение количества уникальных книг в Telegram канале...');
      const telegramClient = await TelegramService.getInstance();
      console.log('✅ Подключение к Telegram установлено');
      
      console.log('Получение канала с метаданными...');
      const channel = await telegramClient.getMetadataChannel();
      console.log(`✅ Канал получен: ${(channel as any).title || 'Неизвестно'}`);
      
      // Подсчитываем уникальные книги в Telegram
      console.log('Подсчет уникальных книг в Telegram...');
      booksInTelegram = await countUniqueBooksInTelegram(telegramClient, channel);
      console.log(`Уникальных книг в Telegram: ${booksInTelegram}`);
    } catch (error: unknown) {
      console.error('Ошибка при подсчете книг в Telegram:', error);
    }

    // Сохраняем статистику в базе данных
    const statsData = {
      books_in_database: booksInDatabase,
      books_in_telegram: booksInTelegram,
      missing_books: Math.max(0, booksInTelegram - booksInDatabase),
      books_without_files: booksWithoutFiles,
      updated_at: new Date().toISOString()
    };

    console.log('\n💾 Сохранение статистики в базе данных...');
    // Обновляем или создаем запись в таблице telegram_stats
    const { error: upsertError } = await supabaseAdmin
      .from('telegram_stats')
      .upsert(statsData, { onConflict: 'id' });

    if (upsertError) {
      console.error('❌ Ошибка при сохранении статистики:', upsertError);
    } else {
      console.log('✅ Статистика успешно сохранена');
    }

    // Выводим итоговую статистику
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   ========================================`);
    console.log(`   Книг в Telegram: ${statsData.books_in_telegram}`);
    console.log(`   Книг в базе данных: ${statsData.books_in_database}`);
    console.log(`   Отсутствующих книг: ${statsData.missing_books}`);
    console.log(`   Книг без файлов: ${statsData.books_without_files}`);
    console.log(`   Последнее обновление: ${statsData.updated_at}`);
    
    console.log('\n✅ Обновление статистики завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики Telegram:', error);
    process.exit(1);
  }
}

updateTelegramStats();