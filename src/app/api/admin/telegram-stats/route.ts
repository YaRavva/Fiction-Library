import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { TelegramService } from '@/lib/telegram/client';
import { TelegramSyncService } from '@/lib/telegram/sync';
import { MetadataParser } from '@/lib/telegram/parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Функция для подсчета уникальных книг в Telegram с прогрессом
async function countUniqueBooksInTelegram(telegramClient: TelegramService, channel: any, onProgress?: (progress: number, message: string) => void): Promise<number> {
  try {
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ?
        (channel.id as { toString: () => string }).toString() :
        String(channel.id);
    
    // Получаем все книги из базы данных для сравнения
    const { data: existingBooks, error: booksError } = await supabaseAdmin
      .from('books')
      .select('id, title, author');
    
    if (booksError) {
      throw new Error(`Ошибка загрузки книг из базы данных: ${booksError.message}`);
    }
    
    // Создаем карту существующих книг для быстрого поиска
    const existingBooksMap = new Map<string, any>();
    existingBooks?.forEach(book => {
      const key = `${book.author}|${book.title}`;
      existingBooksMap.set(key, book);
    });
    
    // Получаем сообщения из Telegram канала и анализируем их
    let totalMessages = 0;
    let bookMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 1000;
    const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
    
    // Сначала получим общее количество сообщений для расчета прогресса
    // (это приблизительная оценка, так как точное количество может быть недоступно)
    let processed = 0;
    
    console.log('Начинаем сканирование Telegram канала...');
    onProgress?.(0, `Начинаем сканирование Telegram канала...`);
    
    while (true) {
      try {
        console.log(`Получаем сообщения с offsetId: ${offsetId}, batchSize: ${batchSize}`);
        const messages = await telegramClient.getMessages(channelId, batchSize, offsetId) as any[];

        console.log(`Получено ${messages?.length || 0} сообщений`);
        
        if (!messages || messages.length === 0) {
          console.log('Нет больше сообщений для обработки');
          break;
        }

        totalMessages += messages.length;

        // Обрабатываем каждое сообщение
        for (const message of messages) {
          try {
            console.log('Обрабатываем сообщение:', typeof message, message?.id);
            
            // В TelegramClient из библиотеки 'telegram' текст сообщения находится в поле 'message'
            // а не в 'text'. Также нужно убедиться, что сообщение существует и не является объектом Media
            let messageText = '';
            if (message && typeof message === 'object') {
              // Проверяем наличие текста в различных возможных полях
              if ('message' in message && message.message && typeof message.message === 'string') {
                messageText = message.message;
                console.log('Найден текст в поле message:', messageText.substring(0, 100) + '...');
              } else if ('text' in message && message.text && typeof message.text === 'string') {
                messageText = message.text;
                console.log('Найден текст в поле text:', messageText.substring(0, 100) + '...');
              } else {
                console.log('Текст в сообщении не найден, ключи объекта:', Object.keys(message || {}));
              }
            } else if (typeof message === 'string') {
              messageText = message;
              console.log('Сообщение является строкой:', messageText.substring(0, 100) + '...');
            }

            if (messageText && typeof messageText === 'string' && messageText.trim() !== '') {
              try {
                // Пытаемся распарсить сообщение как метаданные книги
                const metadata = MetadataParser.parseMessage(messageText);
                
                console.log('Результат парсинга:', metadata.author, metadata.title);
                
                // Проверяем, выглядит ли это как книга (есть автор и название)
                if (metadata.author && metadata.title) {
                  bookMessages++;
                  const bookKey = `${metadata.author}|${metadata.title}`;
                  
                  // Добавляем в набор уникальных книг
                  if (!bookSet.has(bookKey)) {
                    bookSet.add(bookKey);
                    console.log(`Добавлена новая уникальная книга: ${bookKey}`);
                  } else {
                    console.log(`Книга уже существует в наборе: ${bookKey}`);
                  }
                } else {
                  console.log('Сообщение не содержит информации о книге');
                }
              } catch (parseError) {
                // Не сообщение с книгой, пропускаем
                console.debug('Не удалось распарсить сообщение как книгу:', parseError);
              }
            } else {
              console.log('Сообщение не содержит текста для обработки');
            }
          } catch (messageError) {
            // Ошибка обработки отдельного сообщения, продолжаем с другими
            console.error('Ошибка при обработке сообщения:', messageError);
            continue;
          }
          
          processed++;
          // Обновляем прогресс каждые 10 сообщений для лучшего отслеживания
          if (processed % 10 === 0) {
            onProgress?.(
              Math.min(90, Math.round((processed / Math.max(processed + 10, 1000)) * 90)),
              `Обработано ${processed} сообщений, найдено уникальных книг: ${bookSet.size}`
            );
          }
        }

        // Устанавливаем offsetId для следующей партии
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.id) {
          offsetId = lastMessage.id;
          console.log(`Установлен offsetId для следующей партии: ${offsetId}`);
        } else {
          console.log('Не удалось получить ID последнего сообщения, завершаем цикл');
          break;
        }

        // Добавляем задержку, чтобы не перегружать Telegram API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (batchError) {
        console.error('Ошибка при получении пакета сообщений:', batchError);
        break; // Прерываем цикл при ошибке получения сообщений
      }
    }
    
    onProgress?.(95, `Завершено сканирование, найдено уникальных книг: ${bookSet.size}`);
    
    return bookSet.size;
    
  } catch (error) {
    console.error('Ошибка при подсчете книг в Telegram:', error);
    throw error;
  }
}

// Функция для обновления статистики с возвратом прогресса
async function updateStatsWithProgress(onProgress?: (progress: number, message: string) => void) {
  try {
    // Получаем количество книг в базе данных
    let booksInDatabase = 0;
    onProgress?.(5, 'Получаем количество книг в базе данных...');
    try {
      const { count, error: booksCountError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true });

      console.log('Результат запроса книг в базе данных:', { count, booksCountError });
      if (booksCountError) {
        console.error('Ошибка получения количества книг в базе:', booksCountError);
      } else {
        booksInDatabase = count || 0;
        console.log(`Найдено книг в базе данных: ${booksInDatabase}`);
      }
    } catch (error: unknown) {
      console.error('Ошибка получения количества книг в базе:', error);
    }

    // Получаем количество книг без файлов
    let booksWithoutFiles = 0;
    onProgress?.(10, 'Получаем количество книг без файлов...');
    try {
      const { count, error: booksWithoutFilesError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true })
        .is('file_url', null);

      console.log('Результат запроса книг без файлов:', { count, booksWithoutFilesError });
      if (booksWithoutFilesError) {
        console.error('Ошибка получения количества книг без файлов:', booksWithoutFilesError);
      } else {
        booksWithoutFiles = count || 0;
        console.log(`Найдено книг без файлов: ${booksWithoutFiles}`);
      }
    } catch (error: unknown) {
      console.error('Ошибка получения количества книг без файлов:', error);
    }

    // Получаем количество уникальных книг в Telegram канале
    let booksInTelegram = 0;
    onProgress?.(15, 'Подключаемся к Telegram каналу...');
    try {
      const telegramClient = await TelegramService.getInstance();
      console.log('Получаем метаданные канала...');
      const channel = await telegramClient.getMetadataChannel();
      console.log('Получен канал для сканирования:', channel);
      
      onProgress?.(20, `Начинаем сканирование Telegram канала...`);
      
      // Подсчитываем уникальные книги в Telegram с отслеживанием прогресса
      booksInTelegram = await countUniqueBooksInTelegram(telegramClient, channel, onProgress);
      console.log(`Найдено книг в Telegram: ${booksInTelegram}`); // Для отладки
    } catch (error: unknown) {
      console.error('Ошибка при подсчете книг в Telegram:', error);
      // Игнорируем ошибки, но логируем их
    }

    // Вычисляем количество отсутствующих книг
    const missingBooks = Math.max(0, booksInTelegram - booksInDatabase);

    // Сохраняем статистику в базе данных
    onProgress?.(98, 'Сохраняем статистику в базе данных...');
    const statsData = {
      books_in_database: booksInDatabase,
      books_in_telegram: booksInTelegram,
      missing_books: missingBooks,
      books_without_files: booksWithoutFiles,
      updated_at: new Date().toISOString()
    };

    console.log('Пытаемся сохранить статистику в базу данных:', statsData);

    // Обновляем или создаем запись в таблице telegram_stats
    const { error: upsertError } = await supabaseAdmin
      .from('telegram_stats')
      .upsert(statsData, { onConflict: 'id' });

    if (upsertError) {
      console.error('Ошибка при сохранении статистики:', upsertError);
    } else {
      console.log('Статистика успешно сохранена в базу данных');
    }

    onProgress?.(100, `Статистика обновлена: 📚 Книг в Telegram: ${booksInTelegram} | 💾 В базе данных: ${booksInDatabase} | ❌ Отсутствуют книги: ${missingBooks} | 📁 Отсутствуют файлы: ${booksWithoutFiles}`);

    return {
      booksInDatabase,
      booksInTelegram,
      missingBooks,
      booksWithoutFiles
    };
  } catch (error) {
    console.error('Ошибка при обновлении статистики:', error);
    throw error;
  }
}

/**
 * GET /api/admin/telegram-stats
 * Получает статистику по книгам в Telegram канале и в базе данных
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Проверяем заголовок Authorization
    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user: bearerUser }, error: bearerError } = await supabaseAdmin.auth.getUser(token);
        if (!bearerError && bearerUser) {
          user = bearerUser;
        }
      } catch (bearerAuthError) {
        // Игнорируем ошибки аутентификации через Bearer токен
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
    if (!user) {
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Пытаемся получить последние сохраненные статистические данные
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      // Если статистика еще не сохранена, возвращаем значения по умолчанию
      return NextResponse.json({
        booksInDatabase: 0,
        booksInTelegram: 0,
        missingBooks: 0,
        booksWithoutFiles: 0,
      });
    }

    // Возвращаем сохраненные статистические данные
    return NextResponse.json({
      booksInDatabase: stats.books_in_database || 0,
      booksInTelegram: stats.books_in_telegram || 0,
      missingBooks: stats.missing_books || 0,
      booksWithoutFiles: stats.books_without_files || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/telegram-stats
 * Запускает обновление статистики с поддержкой прогресса
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Проверяем заголовок Authorization
    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user: bearerUser }, error: bearerError } = await supabaseAdmin.auth.getUser(token);
        if (!bearerError && bearerUser) {
          user = bearerUser;
        }
      } catch (bearerAuthError) {
        // Игнорируем ошибки аутентификации через Bearer токен
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
    if (!user) {
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Проверяем, запрошено ли синхронное обновление с прогрессом
    const url = new URL(request.url);
    const syncParam = url.searchParams.get('sync');
    
    if (syncParam === 'true') {
      // Синхронное обновление с возвратом прогресса
      const progressMessages: { progress: number; message: string }[] = [];
      const onProgress = (progress: number, message: string) => {
        progressMessages.push({ progress, message });
      };
      
      try {
        const stats = await updateStatsWithProgress(onProgress);
        
        return NextResponse.json({
          message: 'Статистика успешно обновлена',
          status: 'completed',
          stats,
          progress: progressMessages
        });
      } catch (error) {
        console.error('Ошибка при обновлении статистики:', error);
        return NextResponse.json(
          {
            error: 'Ошибка при обновлении статистики',
            details: error instanceof Error ? error.message : 'Неизвестная ошибка',
            status: 'error'
          },
          { status: 500 }
        );
      }
    } else {
      // Фоновое обновление (для обратной совместимости)
      updateStatsWithProgress()
        .then(() => {
          console.log('Фоновое обновление статистики успешно завершено');
        })
        .catch((error: unknown) => {
          console.error('Ошибка в фоновом обновлении статистики:', error);
        });

      // Возвращаем сразу, не дожидаясь завершения фоновой операции
      return NextResponse.json({
        message: 'Обновление статистики успешно запущено',
        status: 'processing'
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера',
        details: error instanceof Error ? error.message : 'Неизвестная ошибка'
      },
      { status: 500 }
    );
  }
}