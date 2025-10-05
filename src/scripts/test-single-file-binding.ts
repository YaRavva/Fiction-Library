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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Тестовая функция для проверки привязки одного файла/книги к серии
 * @param bookId ID книги в базе данных для тестирования
 */
async function testSingleFileBinding(bookId: string) {
  try {
    console.log(`🚀 Начинаем тестирование привязки файла для книги с ID: ${bookId}`);
    
    // Получаем конкретную книгу по ID
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, author, series_id, telegram_post_id')
      .eq('id', bookId)
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении книги:', bookError);
      return;
    }
    
    if (!book) {
      console.log(`❌ Книга с ID ${bookId} не найдена`);
      return;
    }
    
    console.log(`📚 Найдена книга: ${book.author} - ${book.title}`);
    console.log(`  Telegram Post ID: ${book.telegram_post_id}`);
    console.log(`  Series ID: ${book.series_id || 'не привязана'}`);
    
    // Проверяем, есть ли telegram_post_id
    if (!book.telegram_post_id) {
      console.log('❌ У книги нет telegram_post_id, невозможно получить состав');
      return;
    }
    
    // Получаем ID сообщения и добавляем смещение
    const storedMessageId = parseInt(book.telegram_post_id);
    const targetMessageId = storedMessageId + 1; // Добавляем смещение
    
    console.log(`📥 Получаем сообщения с offsetId: ${targetMessageId}...`);
    
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
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений:`);
    messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ID: ${msg.id || 'undefined'}`);
    });
    
    // Ищем сообщение с ID, которое на 1 меньше запрошенного (смещение)
    const targetMessage = messages.find(msg => msg.id === storedMessageId);
    if (!targetMessage) {
      console.log(`ℹ️  Точное сообщение с ID ${storedMessageId} не найдено в результатах`);
      return;
    }
    
    console.log(`✅ Найдено целевое сообщение: ${targetMessage.id}`);
    
    if (!targetMessage.text) {
      console.log('❌ Сообщение не содержит текста');
      return;
    }
    
    // Парсим текст сообщения
    const metadata = MetadataParser.parseMessage(targetMessage.text);
    
    // Проверяем, есть ли состав
    if (!metadata.books || metadata.books.length === 0) {
      console.log('ℹ️  В сообщении нет состава (series_composition)');
      
      // Проверим, содержит ли сообщение слово "Состав:"
      if (targetMessage.text.includes('Состав:')) {
        console.log('✅ Сообщение содержит "Состав:", но парсер не извлек состав');
        console.log('📝 Текст сообщения (первые 500 символов):');
        console.log(targetMessage.text.substring(0, 500) + (targetMessage.text.length > 500 ? '...' : ''));
      } else {
        console.log('📝 Текст сообщения (первые 500 символов):');
        console.log(targetMessage.text.substring(0, 500) + (targetMessage.text.length > 500 ? '...' : ''));
      }
      
      return;
    }
    
    console.log(`📚 Найден состав из ${metadata.books.length} книг:`);
    metadata.books.forEach((book, index) => {
      console.log(`  ${index + 1}. ${book.title} (${book.year})`);
    });
    
    // Проверяем, привязана ли книга к серии
    if (book.series_id) {
      console.log(`ℹ️  Книга уже привязана к серии ${book.series_id}`);
      
      // Получаем информацию о серии
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('series_composition')
        .eq('id', book.series_id)
        .single();
      
      if (seriesError) {
        console.error('❌ Ошибка при получении информации о серии:', seriesError);
        return;
      }
      
      // Сравниваем состав
      const currentComposition = series.series_composition || [];
      console.log(`📊 Текущий состав в базе: ${currentComposition.length} книг`);
      
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
        console.log('⚠️  Состав не совпадает, обновляем...');
        
        // Обновляем состав серии
        const { error: updateError } = await supabase
          .from('series')
          .update({ 
            series_composition: metadata.books,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.series_id);
        
        if (updateError) {
          console.error('❌ Ошибка при обновлении состава серии:', updateError);
        } else {
          console.log('✅ Состав серии обновлен');
        }
      } else {
        console.log('✅ Состав совпадает, обновление не требуется');
      }
    } else {
      console.log('📗 Книга не привязана к серии');
      
      // Проверяем, есть ли состав для создания серии
      if (metadata.books && metadata.books.length > 0) {
        console.log('➕ Создание новой серии из состава...');
        
        // Создаем серию
        const seriesData: any = {
          title: metadata.series || metadata.title || book.title,
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
          console.error('❌ Ошибка при создании серии:', seriesError);
        } else {
          const newSeriesId = (insertedSeries as any).id;
          console.log(`✅ Серия создана с ID: ${newSeriesId}`);
          
          // Привязываем книгу к серии
          const { error: updateError } = await supabase
            .from('books')
            .update({ series_id: newSeriesId })
            .eq('id', book.id);
          
          if (updateError) {
            console.error('❌ Ошибка при привязке книги к серии:', updateError);
          } else {
            console.log('✅ Книга привязана к серии');
          }
        }
      } else {
        console.log('ℹ️  Нет состава для создания серии');
      }
    }
    
    console.log('\n✅ Тестирование привязки файла завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Проверяем, передан ли ID книги как аргумент командной строки
if (process.argv.length < 3) {
  console.log('ℹ️  Использование: npx tsx test-single-file-binding.ts <book-id>');
  console.log('ℹ️  Пример: npx tsx test-single-file-binding.ts 12345678-1234-1234-1234-123456789012');
  
  // Если не передан ID, попробуем получить первую книгу с составом для тестирования
  console.log('\n🔍 Ищем книгу с составом для демонстрации...');
  
  supabase
    .from('books')
    .select('id, title, author, telegram_post_id')
    .not('telegram_post_id', 'is', null)
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Ошибка при поиске книги:', error);
        process.exit(1);
      }
      
      if (!data || data.length === 0) {
        console.log('❌ Не найдено книг с telegram_post_id');
        process.exit(1);
      }
      
      console.log(`✅ Найдена книга для тестирования:`);
      console.log(`  ID: ${data[0].id}`);
      console.log(`  Название: ${data[0].title}`);
      console.log(`  Автор: ${data[0].author}`);
      console.log(`  Telegram Post ID: ${data[0].telegram_post_id}`);
      console.log('\nℹ️  Для тестирования запустите:');
      console.log(`  npx tsx test-single-file-binding.ts ${data[0].id}`);
      process.exit(0);
    });
} else {
  // Запускаем тест с указанным ID книги
  const bookId = process.argv[2];
  testSingleFileBinding(bookId);
}