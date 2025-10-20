import { createClient } from '@supabase/supabase-js';
import { TelegramService } from './client';
import { MetadataParser } from './parser';
import dotenv from 'dotenv';

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface TelegramStats {
  id?: string;
  books_in_database: number;
  books_in_telegram: number;
  missing_books: number;
  books_without_files: number;
  updated_at: string;
}

export async function updateTelegramStats(): Promise<TelegramStats | null> {
  console.log('📊 Обновление статистики Telegram...');
  
  try {
    // Получаем количество книг в базе данных
    console.log('\n📚 Получение количества книг в базе данных...');
    const { count: booksInDatabase, error: booksCountError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (booksCountError) {
      console.error('❌ Ошибка при получении количества книг:', booksCountError);
      return null;
    }

    console.log(`✅ Книг в базе данных: ${booksInDatabase || 0}`);

    // Получаем количество книг без файлов
    console.log('\n📁 Получение количества книг без файлов...');
    const { count: booksWithoutFiles, error: booksWithoutFilesError } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('file_url', null);

    if (booksWithoutFilesError) {
      console.error('❌ Ошибка при получении количества книг без файлов:', booksWithoutFilesError);
      return null;
    }

    console.log(`✅ Книг без файлов: ${booksWithoutFiles || 0}`);

    // Получаем количество уникальных книг в Telegram канале
    console.log('\n📡 Подсчет уникальных книг в Telegram канале...');
    let booksInTelegram = 0;
    
    try {
      // Инициализируем Telegram клиент
      const telegramService = await TelegramService.getInstance();
      
      // Получаем канал с метаданными
      const channel = await telegramService.getMetadataChannel();
      
      // Convert BigInteger to string for compatibility
      const channelId = typeof channel.id === 'object' && channel.id !== null ?
          (channel.id as { toString: () => string }).toString() :
          String(channel.id);
      
      console.log(`✅ Подключено к каналу ID: ${channelId}`);
      
      // Получаем все книги из базы данных для сравнения
      console.log('\n📚 Загрузка существующих книг из базы данных...');
      const { data: existingBooks, error: booksError } = await supabaseAdmin
        .from('books')
        .select('id, title, author');
      
      if (booksError) {
        throw new Error(`Ошибка загрузки книг из базы данных: ${booksError.message}`);
      }
      
      console.log(`✅ Загружено ${existingBooks?.length || 0} существующих книг из базы данных`);
      
      // Получаем сообщения из Telegram канала и анализируем их
      let offsetId: number | undefined = undefined;
      const batchSize = 100;
      const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
      let processed = 0;
      
      console.log('\n📥 Начало сканирования Telegram канала...');
      
      while (true) {
        try {
          const messages = await telegramService.getMessages(channelId, batchSize, offsetId) as any[];

          if (!messages || messages.length === 0) {
            break;
          }

          // Обрабатываем каждое сообщение
          for (const message of messages) {
            // Извлекаем текст сообщения
            let messageText = '';
            if (message && typeof message === 'object') {
              if ('message' in message && message.message && typeof message.message === 'string') {
                messageText = message.message;
              } else if ('text' in message && message.text && typeof message.text === 'string') {
                messageText = message.text;
              }
            }

            if (messageText && typeof messageText === 'string' && messageText.trim() !== '') {
              try {
                // Пытаемся распарсить сообщение как метаданные книги
                const metadata = MetadataParser.parseMessage(messageText);
                
                // Проверяем, выглядит ли это как книга (есть автор и название)
                if (metadata.author && metadata.title) {
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
            
            processed++;
            
            // Показываем прогресс каждые 100 сообщений
            if (processed % 100 === 0) {
              console.log(`📊 Прогресс: ${processed} сообщений обработано, ${bookSet.size} уникальных книг найдено`);
            }
          }

          // Устанавливаем offsetId для следующей партии
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.id) {
            offsetId = lastMessage.id;
          } else {
            break;
          }

          // Добавляем задержку, чтобы не перегружать Telegram API
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (batchError) {
          console.error('❌ Ошибка при получении пакета сообщений:', batchError);
          break;
        }
      }
      
      booksInTelegram = bookSet.size;
      console.log(`✅ Найдено ${booksInTelegram} уникальных книг в Telegram`);
      
      // Отключаем Telegram клиент
      await telegramService.disconnect();
      console.log('📱 Telegram клиент отключен');
      
    } catch (telegramError) {
      console.error('❌ Ошибка при подсчете книг в Telegram:', telegramError);
      return null;
    }

    // Вычисляем количество отсутствующих книг
    const missingBooks = Math.max(0, booksInTelegram - (booksInDatabase || 0));

    // Сохраняем статистику в базе данных
    console.log('\n💾 Сохранение статистики в базе данных...');
    const statsData: TelegramStats = {
      books_in_database: booksInDatabase || 0,
      books_in_telegram: booksInTelegram,
      missing_books: missingBooks,
      books_without_files: booksWithoutFiles || 0,
      updated_at: new Date().toISOString()
    };

    console.log('Данные для сохранения:', statsData);

    // Обновляем или создаем запись в таблице telegram_stats
    const { error: upsertError } = await supabaseAdmin
      .from('telegram_stats')
      .upsert(statsData, { onConflict: 'id' });

    if (upsertError) {
      console.error('❌ Ошибка при сохранении статистики:', upsertError);
      return null;
    }

    console.log('✅ Статистика успешно сохранена в базу данных');
    
    // Выводим итоговые результаты
    console.log('\n📈 === ИТОГОВАЯ СТАТИСТИКА ===');
    console.log(`📚 Книг в базе данных: ${statsData.books_in_database}`);
    console.log(`📡 Книг в Telegram: ${statsData.books_in_telegram}`);
    console.log(`❌ Отсутствующих книг: ${statsData.missing_books}`);
    console.log(`📁 Книг без файлов: ${statsData.books_without_files}`);
    console.log(`🕒 Последнее обновление: ${new Date(statsData.updated_at).toLocaleString()}`);
    
    console.log('\n✅ Обновление статистики завершено успешно');
    
    return statsData;
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики:', error);
    return null;
  }
}
