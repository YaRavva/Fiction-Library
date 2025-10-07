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
    console.log('Counting unique books in Telegram channel...');
    
    // Convert BigInteger to string for compatibility
    const channelId = typeof channel.id === 'object' && channel.id !== null ? 
        (channel.id as { toString: () => string }).toString() : 
        String(channel.id);
    
    // Получаем все книги из базы данных для сравнения
    console.log('Fetching existing books from database for comparison...');
    const { data: existingBooks, error: booksError } = await supabaseAdmin
      .from('books')
      .select('id, title, author');
    
    if (booksError) {
      console.error(`Error fetching books from database: ${booksError.message}`);
      throw new Error(`Error fetching books from database: ${booksError.message}`);
    }
    
    console.log(`Loaded ${existingBooks?.length || 0} books from database`);
    
    // Создаем карту существующих книг для быстрого поиска
    const existingBooksMap = new Map<string, any>();
    existingBooks?.forEach(book => {
      const key = `${book.author}|${book.title}`;
      existingBooksMap.set(key, book);
    });
    
    // Получаем сообщения из Telegram канала и анализируем их
    console.log('Analyzing messages from Telegram channel...');
    
    let totalMessages = 0;
    let bookMessages = 0;
    let offsetId: number | undefined = undefined;
    const batchSize = 100;
    const bookSet = new Set<string>(); // Для отслеживания уникальных книг в Telegram
    
    while (true) {
      console.log(`Processing batch of messages (total processed: ${totalMessages})...`);
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
      
      console.log(`  Processed: ${messages.length} messages, found books: ${bookMessages}`);
      
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
    
    console.log(`Total unique books in Telegram: ${bookSet.size}`);
    return bookSet.size;
    
  } catch (error) {
    console.error('Error counting unique books in Telegram:', error);
    throw error;
  }
}

// Функция для обновления статистики в фоновом режиме
async function updateStatsInBackground() {
  try {
    console.log('Starting background stats update...');
    
    // Получаем количество книг в базе данных
    let booksInDatabase = 0;
    try {
      console.log('Attempting to count books in database...');
      const { count, error: booksCountError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true });

      if (booksCountError) {
        console.error(`Error counting books in database: ${booksCountError.message}`);
      } else {
        booksInDatabase = count || 0;
      }
      console.log(`Books counted in database: ${booksInDatabase}`);
    } catch (error: unknown) {
      console.error('Error counting books in database:', error);
    }

    // Получаем количество книг без файлов
    let booksWithoutFiles = 0;
    try {
      console.log('Attempting to count books without files...');
      const { count, error: booksWithoutFilesError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true })
        .is('file_url', null);

      if (booksWithoutFilesError) {
        console.error(`Error counting books without files: ${booksWithoutFilesError.message}`);
      } else {
        booksWithoutFiles = count || 0;
      }
      console.log(`Books without files counted: ${booksWithoutFiles}`);
    } catch (error: unknown) {
      console.error('Error counting books without files:', error);
    }

    // Получаем количество уникальных книг в Telegram канале
    let booksInTelegram = 0;
    try {
      console.log('Attempting to initialize Telegram client...');
      const telegramClient = await TelegramService.getInstance();
      console.log('Telegram client initialized successfully');
      
      console.log('Attempting to get metadata channel...');
      const channel = await telegramClient.getMetadataChannel();
      console.log('Metadata channel obtained successfully');
      
      // Подсчитываем уникальные книги в Telegram
      console.log('Counting unique books in Telegram...');
      booksInTelegram = await countUniqueBooksInTelegram(telegramClient, channel);
      console.log(`Unique books counted in Telegram: ${booksInTelegram}`);
    } catch (error: unknown) {
      console.error('Error counting books in Telegram:', error);
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
      console.error('Error upserting stats data:', upsertError);
    } else {
      console.log('Stats data upserted successfully');
    }

    console.log('Background stats update completed');
  } catch (error) {
    console.error('Error in background stats update:', error);
  }
}

/**
 * GET /api/admin/telegram-stats
 * Получает статистику по книгам в Telegram канале и в базе данных
 */
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/admin/telegram-stats called');
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
      console.log('Using Bearer token for authentication');
      try {
        const { data: { user: bearerUser }, error: bearerError } = await supabaseAdmin.auth.getUser(token);
        if (!bearerError && bearerUser) {
          console.log('Authenticated via Bearer token');
          user = bearerUser;
        } else {
          console.log('Bearer token authentication failed:', bearerError?.message);
        }
      } catch (bearerAuthError) {
        console.log('Error during Bearer token authentication:', bearerAuthError);
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
    if (!user) {
      console.log('Trying to authenticate via cookies');
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    console.log('User authentication check (GET):', { userId: user?.id, userEmail: user?.email });

    if (!user) {
      console.log('User not authenticated (GET), returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем роль админа
    console.log('Checking user role for user:', user.id);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Profile check result (GET):', { profile, profileError });

    if (profileError || profile?.role !== 'admin') {
      console.log('User is not admin (GET), returning 403');
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
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
      console.log('No existing stats found, returning default values');
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
    console.error('Error getting Telegram stats:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
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
    console.log('POST /api/admin/telegram-stats called - starting async stats update');
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
      console.log('Using Bearer token for authentication');
      try {
        const { data: { user: bearerUser }, error: bearerError } = await supabaseAdmin.auth.getUser(token);
        if (!bearerError && bearerUser) {
          console.log('Authenticated via Bearer token');
          user = bearerUser;
        } else {
          console.log('Bearer token authentication failed:', bearerError?.message);
        }
      } catch (bearerAuthError) {
        console.log('Error during Bearer token authentication:', bearerAuthError);
      }
    }
    
    // Если не удалось авторизоваться через Bearer токен, пробуем через cookies
    if (!user) {
      console.log('Trying to authenticate via cookies');
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      user = cookieUser;
    }

    console.log('User authentication check (POST):', { userId: user?.id, userEmail: user?.email });

    if (!user) {
      console.log('User not authenticated (POST), returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем роль админа
    console.log('Checking user role for user (POST):', user.id);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('Profile check result (POST):', { profile, profileError });

    if (profileError || profile?.role !== 'admin') {
      console.log('User is not admin (POST), returning 403');
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Запускаем обновление статистики в фоновом режиме
    updateStatsInBackground()
      .then(() => {
        console.log('Background stats update completed successfully');
      })
      .catch((error) => {
        console.error('Error in background stats update:', error);
      });

    // Возвращаем сразу, не дожидаясь завершения фоновой операции
    return NextResponse.json({
      message: 'Stats update started successfully',
      status: 'processing'
    });
  } catch (error) {
    console.error('Error starting stats update:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}