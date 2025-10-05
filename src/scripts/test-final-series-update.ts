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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  // Принудительно завершаем скрипт из-за известной проблемы с GramJS
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFinalSeriesUpdate() {
  try {
    console.log('🚀 Начинаем тестирование финального обновления состава серии');
    
    // Получаем 10 случайных книг для тестирования
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, series_id, telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (booksError) {
      console.error('❌ Ошибка при получении книг:', booksError);
      // Принудительно завершаем скрипт из-за известной проблемы с GramJS
      setTimeout(() => {
        process.exit(1);
      }, 1000);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книги не найдены');
      // Принудительно завершаем скрипт из-за известной проблемы с GramJS
      setTimeout(() => {
        process.exit(1);
      }, 1000);
      return;
    }
    
    console.log(`📚 Найдено ${books.length} книг для тестирования:`);
    books.forEach((book, index) => {
      console.log(`${index + 1}. ${book.author} - ${book.title}`);
      console.log(`   Telegram Post ID: ${book.telegram_post_id}`);
      console.log(`   Series ID: ${book.series_id || 'не привязана'}`);
    });
    
    // Тестируем логику скрипта на каждой книге
    for (const book of books) {
      console.log(`\n🔍 Тестируем книгу: ${book.author} - ${book.title}`);
      
      // Проверяем, есть ли telegram_post_id
      if (!book.telegram_post_id) {
        console.log('  ℹ️  У книги нет telegram_post_id, пропускаем');
        continue;
      }
      
      // Получаем ID сообщения и добавляем смещение
      const storedMessageId = parseInt(book.telegram_post_id);
      const targetMessageId = storedMessageId + 1; // Добавляем смещение
      
      console.log(`  📥 Получаем сообщения с offsetId: ${targetMessageId}...`);
      
      // Инициализируем Telegram клиент
      const telegramClient = await TelegramService.getInstance();
      
      // Получаем канал с метаданными
      const channel = await telegramClient.getMetadataChannel();
      const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
      
      // Получаем сообщения с учетом смещения
      const messages = await telegramClient.getMessages(channelId, 5, targetMessageId) as unknown as { id?: number; text?: string }[];
      
      if (!messages || messages.length === 0) {
        console.log('  ❌ Сообщения не найдены');
        continue;
      }
      
      console.log(`  ✅ Получено ${messages.length} сообщений:`);
      messages.forEach((msg, index) => {
        console.log(`    ${index + 1}. ID: ${msg.id || 'undefined'}`);
      });
      
      // Ищем сообщение с ID, которое на 1 меньше запрошенного (смещение)
      const targetMessage = messages.find(msg => msg.id === storedMessageId);
      if (!targetMessage) {
        console.log(`  ℹ️  Точное сообщение с ID ${storedMessageId} не найдено в результатах`);
        continue;
      }
      
      console.log(`  ✅ Найдено целевое сообщение: ${targetMessage.id}`);
      
      if (!targetMessage.text) {
        console.log('  ❌ Сообщение не содержит текста');
        continue;
      }
      
      // Парсим текст сообщения
      const metadata = MetadataParser.parseMessage(targetMessage.text);
      
      // Проверяем, есть ли состав
      if (!metadata.books || metadata.books.length === 0) {
        console.log('  ℹ️  В сообщении нет состава');
        continue;
      }
      
      console.log(`  📚 Найден состав из ${metadata.books.length} книг:`);
      metadata.books.forEach((book, index) => {
        console.log(`    ${index + 1}. ${book.title} (${book.year})`);
      });
      
      // Проверяем, привязана ли книга к серии
      if (book.series_id) {
        console.log(`  ℹ️  Книга уже привязана к серии ${book.series_id}`);
        
        // Получаем информацию о серии
        const { data: series, error: seriesError } = await supabase
          .from('series')
          .select('series_composition')
          .eq('id', book.series_id)
          .single();
        
        if (seriesError) {
          console.error('  ❌ Ошибка при получении информации о серии:', seriesError);
          continue;
        }
        
        // Сравниваем состав
        const currentComposition = series.series_composition || [];
        console.log(`  📊 Текущий состав в базе: ${currentComposition.length} книг`);
        
        // Проверяем, совпадает ли состав
        let compositionsMatch = true;
        if (currentComposition.length !== metadata.books.length) {
          compositionsMatch = false;
        } else {
          for (let j = 0; j < metadata.books.length; j++) {
            const bookFromMessage = metadata.books[j];
            const bookFromSeries = currentComposition[j];
            if (bookFromMessage.title !== bookFromSeries.title || bookFromMessage.year !== bookFromSeries.year) {
              compositionsMatch = false;
              break;
            }
          }
        }
        
        if (!compositionsMatch) {
          console.log('  ⚠️  Состав не совпадает, требуется обновление');
        } else {
          console.log('  ✅ Состав совпадает, обновление не требуется');
        }
      } else {
        console.log('  📗 Книга не привязана к серии');
        console.log('  ➕ Создание новой серии...');
        
        // Создаем серию
        const seriesData: any = {
          title: book.title,
          author: book.author,
          description: metadata.description || '',
          genres: metadata.genres.length > 0 ? metadata.genres : [],
          tags: metadata.tags.length > 0 ? metadata.tags : [],
          rating: metadata.rating || null,
          telegram_post_id: String(targetMessage.id || ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          series_composition: metadata.books
        };
        
        const { data: insertedSeries, error: seriesError } = await supabase
          .from('series')
          .insert(seriesData)
          .select()
          .single();
        
        if (seriesError) {
          console.error('  ❌ Ошибка при создании серии:', seriesError);
        } else {
          const newSeriesId = (insertedSeries as any).id;
          console.log(`  ✅ Серия создана: ${newSeriesId}`);
          
          // Привязываем книгу к серии
          const { error: updateError } = await supabase
            .from('books')
            .update({ series_id: newSeriesId })
            .eq('id', book.id);
          
          if (updateError) {
            console.error('  ❌ Ошибка при привязке книги к серии:', updateError);
          } else {
            console.log('  ✅ Книга привязана к серии');
          }
        }
      }
    }
    
    console.log('\n✅ Тестирование завершено!');
    
    // Принудительно завершаем скрипт из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
    // Принудительно завершаем скрипт из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

// Запускаем тест
testFinalSeriesUpdate();