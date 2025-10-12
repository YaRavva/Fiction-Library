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

// Функция для подсчета уникальных книг в Telegram
async function countUniqueBooksInTelegram(telegramClient: TelegramService, channel: any): Promise<number> {
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
    
    while (true) {
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
    
    return bookSet.size;
    
  } catch (error) {
    throw error;
  }
}

// Функция для обновления статистики в фоновом режиме
async function updateStatsInBackground() {
  try {
    // Получаем количество книг в базе данных
    let booksInDatabase = 0;
    try {
      const { count, error: booksCountError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true });

      if (booksCountError) {
        // Игнорируем ошибки
      } else {
        booksInDatabase = count || 0;
      }
    } catch (error: unknown) {
      // Игнорируем ошибки
    }

    // Получаем количество книг без файлов
    let booksWithoutFiles = 0;
    try {
      const { count, error: booksWithoutFilesError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true })
        .is('file_url', null);

      if (booksWithoutFilesError) {
        // Игнорируем ошибки
      } else {
        booksWithoutFiles = count || 0;
      }
    } catch (error: unknown) {
      // Игнорируем ошибки
    }

    // Получаем количество уникальных книг в Telegram канале
    let booksInTelegram = 0;
    try {
      const telegramClient = await TelegramService.getInstance();
      const channel = await telegramClient.getMetadataChannel();
      
      // Подсчитываем уникальные книги в Telegram
      booksInTelegram = await countUniqueBooksInTelegram(telegramClient, channel);
    } catch (error: unknown) {
      // Игнорируем ошибки
    }

    // Сохраняем статистику в базе данных
    const statsData = {
      books_in_database: booksInDatabase,
      books_in_telegram: booksInTelegram,
      missing_books: Math.max(0, booksInTelegram - booksInDatabase),
      books_without_files: booksWithoutFiles,
      updated_at: new Date().toISOString()
    };

    // Обновляем или создаем запись в таблице telegram_stats
    const { error: upsertError } = await supabaseAdmin
      .from('telegram_stats')
      .upsert(statsData, { onConflict: 'id' });

    if (upsertError) {
      // Игнорируем ошибки
    }
  } catch (error) {
    // Игнорируем ошибки
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
 * Запускает асинхронное обновление статистики
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

    // Запускаем обновление статистики в фоновом режиме
    updateStatsInBackground()
      .then(() => {
        // Фоновое обновление статистики успешно завершено
      })
      .catch((error) => {
        // Ошибка в фоновом обновлении статистики
      });

    // Возвращаем сразу, не дожидаясь завершения фоновой операции
    return NextResponse.json({
      message: 'Обновление статистики успешно запущено',
      status: 'processing'
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