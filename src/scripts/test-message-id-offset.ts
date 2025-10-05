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

async function testMessageIdOffset() {
  try {
    console.log('🔍 Тестируем метод увеличения ID сообщения на 1 для нахождения нужной книги');
    
    // Получаем несколько книг с telegram_post_id для тестирования
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .limit(10); // Ограничиваем 10 книгами для тестирования
    
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
        const storedMessageId = parseInt(book.telegram_post_id);
        const targetMessageId = storedMessageId + 1; // Увеличиваем ID на 1
        
        console.log(`\n📝 Тест ${totalCount}/${books.length}:`);
        console.log(`  Книга: ${book.author} - ${book.title}`);
        console.log(`  Сохраненный ID: ${storedMessageId}`);
        console.log(`  Целевой ID: ${targetMessageId}`);
        
        // Получаем канал с метаданными
        const channel = await telegramClient.getMetadataChannel();
        const channelId = typeof channel.id === 'object' && channel.id !== null ? 
          (channel.id as { toString: () => string }).toString() : 
          String(channel.id);
        
        // Получаем сообщение с увеличенным ID
        const messages = await telegramClient.getMessages(channelId, 5, targetMessageId) as unknown as { id?: number; text?: string }[];
        
        if (!messages || messages.length === 0) {
          console.log(`  ℹ️  Сообщение не найдено`);
          continue;
        }
        
        // Ищем сообщение с точным совпадением целевого ID
        const targetMessage = messages.find(msg => msg.id === targetMessageId);
        if (!targetMessage) {
          console.log(`  ℹ️  Точное сообщение не найдено (получены соседние сообщения)`);
          continue;
        }
        
        if (!targetMessage.text) {
          console.log(`  ℹ️  Сообщение не содержит текста`);
          continue;
        }
        
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(targetMessage.text);
        
        // Проверяем совпадение автора и названия
        if (metadata.author === book.author && metadata.title === book.title) {
          console.log(`  ✅ Совпадение найдено!`);
          console.log(`    Автор: "${metadata.author}"`);
          console.log(`    Название: "${metadata.title}"`);
          successCount++;
        } else {
          console.log(`  ❌ Несовпадение:`);
          console.log(`    Автор из сообщения: "${metadata.author}"`);
          console.log(`    Автор книги: "${book.author}"`);
          console.log(`    Название из сообщения: "${metadata.title}"`);
          console.log(`    Название книги: "${book.title}"`);
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
      console.log(`\n✅ Метод увеличения ID на 1 работает в ${Math.round((successCount / totalCount) * 100)}% случаев`);
    } else {
      console.log(`\n❌ Метод увеличения ID на 1 не работает`);
    }
    
    console.log('\n✅ Тестирование завершено!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
testMessageIdOffset();