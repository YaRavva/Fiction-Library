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

async function universalSeriesUpdate() {
  try {
    console.log('🚀 Начинаем универсальное обновление состава серий');
    
    // Получаем конкретную книгу для тестирования
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, author, series_id, telegram_post_id')
      .eq('title', 'цикл Корабль во фьорде')
      .eq('author', 'Елизавета Дворецкая')
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении книги:', bookError);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log(`📚 Найдена книга: ${book.author} - ${book.title}`);
    console.log(`  Telegram Post ID: ${book.telegram_post_id}`);
    console.log(`  Series ID: ${book.series_id || 'не привязана'}`);
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    // Получаем канал с метаданными
    const channel = await telegramClient.getMetadataChannel();
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Определяем, какой метод использовать для поиска сообщения
    const storedMessageId = parseInt(book.telegram_post_id);
    let targetMessage = null;
    
    // Если ID сообщения >= 4797, пытаемся получить его напрямую
    if (storedMessageId >= 4797) {
      console.log(`📥 Пытаемся получить сообщение напрямую по ID: ${storedMessageId}`);
      
      try {
        const messages = await telegramClient.getMessages(channelId, 5, storedMessageId) as unknown as { id?: number; text?: string }[];
        
        if (messages && messages.length > 0) {
          // Ищем сообщение с точным совпадением ID
          targetMessage = messages.find(msg => msg.id === storedMessageId);
          
          if (targetMessage) {
            console.log(`✅ Сообщение найдено напрямую по ID: ${targetMessage.id}`);
          } else {
            console.log(`ℹ️  Точное сообщение не найдено, получены соседние сообщения`);
          }
        }
      } catch (error: unknown) {
        console.log(`⚠️  Ошибка при попытке получить сообщение по ID:`, (error as Error).message);
      }
    }
    
    // Если сообщение не найдено напрямую, ищем по содержимому
    if (!targetMessage) {
      console.log(`🔍 Ищем сообщение по содержимому...`);
      
      // Получаем последние 100 сообщений из канала
      console.log('📥 Получаем последние 100 сообщений из канала...');
      const messages = await telegramClient.getMessages(channelId, 100) as unknown as { id?: number; text?: string }[];
      
      if (!messages || messages.length === 0) {
        console.log('❌ Сообщения не найдены');
        return;
      }
      
      console.log(`✅ Получено ${messages.length} сообщений`);
      
      // Ищем сообщение по автору и названию
      for (const message of messages) {
        if (message.text) {
          try {
            const metadata = MetadataParser.parseMessage(message.text);
            if (metadata.author === book.author && metadata.title === book.title) {
              targetMessage = message;
              console.log(`✅ Сообщение найдено по содержимому: ${targetMessage.id}`);
              break;
            }
          } catch (parseError) {
            // Игнорируем ошибки парсинга отдельных сообщений
          }
        }
      }
    }
    
    if (!targetMessage || !targetMessage.text) {
      console.log('❌ Сообщение не найдено');
      return;
    }
    
    // Парсим текст сообщения
    const metadata = MetadataParser.parseMessage(targetMessage.text);
    
    // Проверяем, есть ли состав
    if (!metadata.books || metadata.books.length === 0) {
      console.log('ℹ️  В сообщении нет состава');
      return;
    }
    
    console.log(`📚 Найден состав из ${metadata.books.length} книг`);
    
    // Если книга уже привязана к серии, обновляем состав
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
          .update({ series_composition: metadata.books })
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
      // Если книга не привязана к серии, создаем новую серию
      console.log('📗 Книга не привязана к серии, создаем новую серию...');
      
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
        console.error('❌ Ошибка при создании серии:', seriesError);
      } else {
        const newSeriesId = (insertedSeries as any).id;
        console.log(`✅ Серия создана: ${newSeriesId}`);
        
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
    }
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log('\n✅ Скрипт завершен!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
universalSeriesUpdate();