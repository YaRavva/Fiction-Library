// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { TelegramService } from '../lib/telegram/client';
import { MetadataParser } from '../lib/telegram/parser';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Используем те же переменные окружения, что и в основном приложении
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMessageByContent() {
  try {
    console.log('🔍 Ищем сообщения по содержимому (автору и названию)');
    
    // Получаем несколько книг для тестирования
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .limit(5); // Ограничиваем 5 книгами для тестирования
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книги с telegram_post_id не найдены');
      return;
    }
    
    console.log(`📚 Найдено книг для тестирования: ${books.length}`);
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    let successCount = 0;
    let totalCount = 0;
    
    // Тестируем каждую книгу
    for (const book of books) {
      try {
        totalCount++;
        console.log(`\n📝 Тест ${totalCount}/${books.length}:`);
        console.log(`  Книга: ${book.author} - ${book.title}`);
        console.log(`  Сохраненный ID: ${book.telegram_post_id}`);
        
        // Получаем канал с метаданными
        const channel = await telegramClient.getMetadataChannel();
        const channelId = typeof channel.id === 'object' && channel.id !== null ? 
          (channel.id as { toString: () => string }).toString() : 
          String(channel.id);
        
        // Получаем последние 100 сообщений из канала
        const messages = await telegramClient.getMessages(channelId, 100) as unknown as { id?: number; text?: string }[];
        
        if (!messages || messages.length === 0) {
          console.log(`  ℹ️  Сообщения не найдены`);
          continue;
        }
        
        console.log(`  🔍 Просматриваем ${messages.length} сообщений...`);
        
        // Ищем сообщение, которое содержит автора и название книги
        let foundMessage = null;
        let foundMessageId = null;
        
        for (const message of messages) {
          if (message.text) {
            // Парсим текст сообщения
            const metadata = MetadataParser.parseMessage(message.text);
            
            // Проверяем совпадение автора и названия
            if (metadata.author === book.author && metadata.title === book.title) {
              foundMessage = message;
              foundMessageId = message.id;
              break;
            }
          }
        }
        
        if (foundMessage && foundMessage.text && foundMessageId) {
          console.log(`  ✅ Сообщение найдено! ID: ${foundMessageId}`);
          
          // Парсим текст сообщения
          const metadata = MetadataParser.parseMessage(foundMessage.text);
          
          console.log(`    Автор: "${metadata.author}"`);
          console.log(`    Название: "${metadata.title}"`);
          
          // Проверяем, есть ли состав
          if (metadata.books && metadata.books.length > 0) {
            console.log(`    Состав: ${metadata.books.length} книг`);
          } else {
            console.log(`    Состав: отсутствует`);
          }
          
          successCount++;
        } else {
          console.log(`  ❌ Сообщение не найдено`);
        }
      } catch (error) {
        console.error(`  ❌ Ошибка при тестировании книги ${book.id}:`, error);
      }
    }
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log(`\n📊 Результаты тестирования:`);
    console.log(`  Всего протестировано: ${totalCount}`);
    console.log(`  Успешных совпадений: ${successCount}`);
    console.log(`  Процент успеха: ${totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0}%`);
    
    if (totalCount > 0 && successCount > 0) {
      console.log(`\n✅ Метод поиска по содержимому работает в ${Math.round((successCount / totalCount) * 100)}% случаев`);
    } else {
      console.log(`\n❌ Метод поиска по содержимому не работает`);
    }
    
    console.log('\n✅ Тестирование завершено!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
findMessageByContent();