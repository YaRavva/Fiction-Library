import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { TelegramService } from '@/lib/telegram/client';
import { TelegramSyncService } from '@/lib/telegram/sync';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // Получаем количество книг в базе данных
    let booksInDatabase = 0;
    try {
      console.log('Attempting to count books in database...');
      const { count, error: booksCountError } = await supabaseAdmin
        .from('books')
        .select('*', { count: 'exact', head: true });

      if (booksCountError) {
        console.error(`Error counting books in database: ${booksCountError.message}`);
        booksInDatabase = 0;
      } else {
        booksInDatabase = count || 0;
        console.log(`Books counted in database: ${booksInDatabase}`);
      }
    } catch (dbError: any) {
      console.error('Error counting books in database:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name
      });
      booksInDatabase = 0;
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
        booksWithoutFiles = 0;
      } else {
        booksWithoutFiles = count || 0;
        console.log(`Books without files counted: ${booksWithoutFiles}`);
      }
    } catch (dbError: any) {
      console.error('Error counting books without files:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name
      });
      booksWithoutFiles = 0;
    }

    // Получаем количество книг в Telegram канале
    let booksInTelegram = 0;
    try {
      console.log('Attempting to initialize Telegram client...');
      const telegramClient = await TelegramService.getInstance();
      console.log('Telegram client initialized successfully');
      
      console.log('Attempting to get metadata channel...');
      const channel = await telegramClient.getMetadataChannel();
      console.log('Metadata channel obtained successfully');
      
      // Получаем первые 1000 сообщений для оценки (можно увеличить при необходимости)
      console.log('Attempting to get messages from channel...');
      const messages = await telegramClient.getMessages(channel, 1000);
      console.log(`Messages retrieved successfully, count: ${Array.isArray(messages) ? messages.length : 0}`);
      
      booksInTelegram = Array.isArray(messages) ? messages.length : 0;
    } catch (error: any) {
      console.error('Error counting books in Telegram:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // Не прекращаем выполнение, просто устанавливаем 0
      booksInTelegram = 0;
    }

    return NextResponse.json({
      booksInDatabase: booksInDatabase || 0,
      booksInTelegram: booksInTelegram,
      missingBooks: Math.max(0, booksInTelegram - (booksInDatabase || 0)),
      booksWithoutFiles: booksWithoutFiles || 0,
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
 * Запускает загрузку отсутствующих книг с прогресс баром и логом
 * 
 * Body:
 * - limit: number (опционально) - количество книг для загрузки (по умолчанию 10)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/admin/telegram-stats called');
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

    // Получаем параметры из body
    let limit = 10;
    try {
      const body = await request.json();
      limit = body.limit || 10;
    } catch (parseError) {
      // Если не удалось распарсить JSON, используем значение по умолчанию
      console.log('Could not parse request body, using default limit');
    }

    // Запускаем синхронизацию отсутствующих файлов
    const syncService = await TelegramSyncService.getInstance();
    const results = await syncService.downloadFilesFromArchiveChannel(limit, true);

    return NextResponse.json({
      message: `Successfully processed ${results.length} files`,
      files: results,
      progress: 100,
      logs: [`Начало загрузки...`, `Обработано файлов: ${results.length}`, `Загрузка завершена`]
    });
  } catch (error: any) {
    console.error('Error starting download of missing books:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}