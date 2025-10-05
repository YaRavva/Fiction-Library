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

async function updateSeriesFromTelegram() {
  try {
    console.log('🚀 Начинаем обновление информации о сериях из Telegram');
    
    // Получаем конкретную книгу для отладки: "Елизавета Дворецкая - цикл Корабль во фьорде"
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Корабль во фьорде')
      .eq('author', 'Елизавета Дворецкая')
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении книги:', bookError);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга "Елизавета Дворецкая - цикл Корабль во фьорде" не найдена в базе данных');
      return;
    }
    
    console.log(`📚 Найдена книга для отладки:`);
    console.log(`- Название: ${book.title}`);
    console.log(`- Автор: ${book.author}`);
    console.log(`- Telegram Post ID: ${book.telegram_post_id}`);
    console.log(`- Series ID: ${book.series_id || 'не привязана'}`);
    
    // Инициализируем Telegram клиент
    const telegramClient = await TelegramService.getInstance();
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
      // Получаем сообщение из Telegram по ID
      const messageId = parseInt(book.telegram_post_id);
      console.log(`\n📡 Получаем сообщение ${messageId} из Telegram...`);
      
      // Получаем канал с метаданными
      const channel = await telegramClient.getMetadataChannel();
      const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
      
      // Получаем конкретное сообщение
      const messages = await telegramClient.getMessages(channelId, 5, messageId) as unknown as { id?: number; text?: string }[];
      
      if (!messages || messages.length === 0) {
        console.log(`  ℹ️  Сообщение не найдено в Telegram`);
        skipped++;
      } else {
        // Ищем сообщение с точным совпадением ID
        const targetMessage = messages.find(msg => msg.id === messageId);
        if (!targetMessage) {
          console.log(`  ℹ️  Точное сообщение не найдено в результатах (Telegram вернул соседние сообщения)`);
          skipped++;
        } else if (!targetMessage.text) {
          console.log(`  ℹ️  Сообщение не содержит текста`);
          skipped++;
        } else {
          // Парсим текст сообщения
          const metadata = MetadataParser.parseMessage(targetMessage.text);
          console.log(`  📊 Извлечено из сообщения: ${metadata.books.length} книг в составе`);
          
          // Дополнительная проверка: совпадают ли автор и название из сообщения с данными книги
          if (metadata.author !== book.author || metadata.title !== book.title) {
            console.log(`  ⚠️  Несовпадение метаданных:`);
            console.log(`      Автор из сообщения: "${metadata.author}"`);
            console.log(`      Автор книги: "${book.author}"`);
            console.log(`      Название из сообщения: "${metadata.title}"`);
            console.log(`      Название книги: "${book.title}"`);
            console.log(`      Пропускаем из-за несовпадения`);
            skipped++;
          } else {
            // Проверяем, есть ли состав
            if (!metadata.books || metadata.books.length === 0) {
              console.log(`  ℹ️  В сообщении нет состава`);
              skipped++;
            } else {
              console.log(`  📚 У книги есть состав из ${metadata.books.length} книг`);
              
              // Проверяем, привязана ли книга к серии
              if (book.series_id) {
                console.log(`  ℹ️  Книга уже привязана к серии ${book.series_id}, проверяем состав...`);
                
                // Получаем информацию о серии
                const { data: series, error: seriesError } = await supabase
                  .from('series')
                  .select('*')
                  .eq('id', book.series_id)
                  .single();
                
                if (seriesError) {
                  console.warn(`  ⚠️  Ошибка при получении информации о серии:`, seriesError);
                  errors++;
                } else {
                  // Сравниваем состав
                  const currentComposition = series.series_composition || [];
                  console.log(`  📊 Текущий состав в базе: ${currentComposition.length} книг`);
                  
                  // Проверяем, совпадает ли состав
                  let compositionsMatch = true;
                  if (currentComposition.length !== metadata.books.length) {
                    compositionsMatch = false;
                  } else {
                    for (let i = 0; i < metadata.books.length; i++) {
                      const bookFromMessage = metadata.books[i];
                      const bookFromSeries = currentComposition[i];
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
                      .update({ 
                        series_composition: metadata.books,
                        title: metadata.title,
                        author: metadata.author,
                        description: metadata.description || '',
                        genres: metadata.genres.length > 0 ? metadata.genres : [],
                        tags: metadata.tags.length > 0 ? metadata.tags : [],
                        rating: metadata.rating || null
                      })
                      .eq('id', book.series_id);
                    
                    if (updateError) {
                      console.warn(`  ⚠️  Ошибка при обновлении состава серии:`, updateError);
                      errors++;
                    } else {
                      console.log(`  ✅ Состав серии обновлен`);
                      updated++;
                    }
                  } else {
                    console.log(`  ✅ Состав совпадает, обновление не требуется`);
                    skipped++;
                  }
                }
              } else {
                console.log(`  📚 Создаем новую серию...`);
                
                // Создаем серию
                const seriesData: any = {
                  title: book.title,
                  author: book.author,
                  description: metadata.description || book.description || '',
                  genres: metadata.genres.length > 0 ? metadata.genres : book.genres || [],
                  tags: metadata.tags.length > 0 ? metadata.tags : book.tags || [],
                  rating: metadata.rating || book.rating || null,
                  telegram_post_id: book.telegram_post_id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  series_composition: metadata.books
                };
                
                // Добавляем обложку, если она есть
                if (book.cover_url) {
                  seriesData.cover_url = book.cover_url;
                }
                
                const { data: insertedSeries, error: seriesError } = await supabase
                  .from('series')
                  .insert(seriesData)
                  .select()
                  .single();
                
                if (seriesError) {
                  console.warn(`  ⚠️  Ошибка при создании серии:`, seriesError);
                  errors++;
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
                    errors++;
                  } else {
                    console.log(`  ✅ Книга привязана к серии`);
                    updated++;
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`  ❌ Ошибка при обработке книги:`, error);
      errors++;
    }
    
    // Завершаем работу Telegram клиента
    if (typeof (telegramClient as unknown as { disconnect?: () => Promise<void> }).disconnect === 'function') {
      await (telegramClient as unknown as { disconnect: () => Promise<void> }).disconnect!();
    }
    
    console.log(`\n📊 Обработка завершена:`);
    console.log(`  - Обновлено: ${updated}`);
    console.log(`  - Пропущено: ${skipped}`);
    console.log(`  - Ошибок: ${errors}`);
    
    console.log('\n✅ Скрипт завершен!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
updateSeriesFromTelegram();