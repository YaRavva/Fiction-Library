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

async function updateAllSeriesCompositions() {
  try {
    console.log('🚀 Начинаем обновление состава всех серий');
    
    // Получаем все книги из базы данных
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, series_id');
    
    if (booksError) {
      console.error('❌ Ошибка при получении списка книг:', booksError);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книги не найдены');
      return;
    }
    
    console.log(`📚 Найдено книг: ${books.length}`);
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Получаем канал с метаданными
    const channel = await telegramClient.getMetadataChannel();
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
      (channel.id as { toString: () => string }).toString() : 
      String(channel.id);
    
    // Получаем последние 100 сообщений из канала (один раз для всех книг)
    console.log('📥 Получаем последние 100 сообщений из канала...');
    const messages = await telegramClient.getMessages(channelId, 100) as unknown as { id?: number; text?: string }[];
    
    if (!messages || messages.length === 0) {
      console.log('❌ Сообщения не найдены');
      return;
    }
    
    console.log(`✅ Получено ${messages.length} сообщений`);
    
    // Создаем карту сообщений по автору и названию для быстрого поиска
    const messageMap = new Map<string, { id?: number; text?: string }>();
    for (const message of messages) {
      if (message.text) {
        try {
          const metadata = MetadataParser.parseMessage(message.text);
          if (metadata.author && metadata.title) {
            const key = `${metadata.author}|||${metadata.title}`;
            messageMap.set(key, message);
          }
        } catch (parseError) {
          // Игнорируем ошибки парсинга отдельных сообщений
        }
      }
    }
    
    console.log(`📋 Создана карта из ${messageMap.size} сообщений`);
    
    // Обрабатываем каждую книгу
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      try {
        console.log(`\n📝 Обрабатываем книгу ${i + 1}/${books.length}: ${book.author} - ${book.title}`);
        
        // Ищем сообщение по автору и названию
        const key = `${book.author}|||${book.title}`;
        const message = messageMap.get(key);
        
        if (!message || !message.text) {
          console.log(`  ℹ️  Сообщение не найдено в последних 100 сообщениях`);
          skippedCount++;
          continue;
        }
        
        // Парсим текст сообщения
        const metadata = MetadataParser.parseMessage(message.text);
        
        // Проверяем, есть ли состав
        if (!metadata.books || metadata.books.length === 0) {
          console.log(`  ℹ️  В сообщении нет состава`);
          skippedCount++;
          continue;
        }
        
        console.log(`  📚 Найден состав из ${metadata.books.length} книг`);
        
        // Если книга уже привязана к серии, обновляем состав
        if (book.series_id) {
          console.log(`  ℹ️  Книга уже привязана к серии ${book.series_id}`);
          
          // Получаем информацию о серии
          const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('series_composition')
            .eq('id', book.series_id)
            .single();
          
          if (seriesError) {
            console.warn(`  ⚠️  Ошибка при получении информации о серии:`, seriesError);
            errorCount++;
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
            console.log(`  ⚠️  Состав не совпадает, обновляем...`);
            
            // Обновляем состав серии
            const { error: updateError } = await supabase
              .from('series')
              .update({ series_composition: metadata.books })
              .eq('id', book.series_id);
            
            if (updateError) {
              console.warn(`  ⚠️  Ошибка при обновлении состава серии:`, updateError);
              errorCount++;
            } else {
              console.log(`  ✅ Состав серии обновлен`);
              updatedCount++;
            }
          } else {
            console.log(`  ✅ Состав совпадает, обновление не требуется`);
            skippedCount++;
          }
        } else {
          // Если книга не привязана к серии, создаем новую серию
          console.log(`  📗 Книга не привязана к серии, создаем новую серию...`);
          
          // Создаем серию
          const seriesData: any = {
            title: book.title,
            author: book.author,
            description: metadata.description || '',
            genres: metadata.genres.length > 0 ? metadata.genres : [],
            tags: metadata.tags.length > 0 ? metadata.tags : [],
            rating: metadata.rating || null,
            telegram_post_id: String(message.id || ''),
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
            console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
            errorCount++;
          } else {
            const newSeriesId = (insertedSeries as any).id;
            console.log(`  ✅ Серия создана: ${newSeriesId}`);
            
            // Привязываем книгу к серии
            const { error: updateError } = await supabase
              .from('books')
              .update({ series_id: newSeriesId })
              .eq('id', book.id);
            
            if (updateError) {
              console.warn(`  ⚠️  Ошибка при привязке книги к серии:`, updateError);
              errorCount++;
            } else {
              console.log(`  ✅ Книга привязана к серии`);
              createdCount++;
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ Ошибка при обработке книги ${book.id}:`, error);
        errorCount++;
      }
    }
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log(`\n📊 Обработка завершена:`);
    console.log(`  Обновлено серий: ${updatedCount}`);
    console.log(`  Создано серий: ${createdCount}`);
    console.log(`  Пропущено: ${skippedCount}`);
    console.log(`  Ошибок: ${errorCount}`);
    
    console.log('\n✅ Скрипт завершен!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
updateAllSeriesCompositions();