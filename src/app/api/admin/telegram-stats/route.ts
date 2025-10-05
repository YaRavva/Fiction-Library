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
      
      // Add timeout wrapper for database operations
      const databaseOperation = async () => {
        const { count, error: booksCountError } = await supabaseAdmin
          .from('books')
          .select('*', { count: 'exact', head: true });

        if (booksCountError) {
          console.error(`Error counting books in database: ${booksCountError.message}`);
          return 0;
        }
        
        return count || 0;
      };
      
      // Wrap in Promise.race with timeout
      const dbTimeoutPromise = new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Database operation timeout after 10 seconds')), 10000)
      );
      
      booksInDatabase = await Promise.race([databaseOperation(), dbTimeoutPromise]);
      console.log(`Books counted in database: ${booksInDatabase}`);
    } catch (error: unknown) {
      console.error('Error counting books in database:', error);
      console.error('Database error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      booksInDatabase = 0;
    }

    // Получаем количество книг без файлов
    let booksWithoutFiles = 0;
    try {
      console.log('Attempting to count books without files...');
      
      // Add timeout wrapper for database operations
      const noFilesOperation = async () => {
        const { count, error: booksWithoutFilesError } = await supabaseAdmin
          .from('books')
          .select('*', { count: 'exact', head: true })
          .is('file_url', null);

        if (booksWithoutFilesError) {
          console.error(`Error counting books without files: ${booksWithoutFilesError.message}`);
          return 0;
        }
        
        return count || 0;
      };
      
      // Wrap in Promise.race with timeout
      const noFilesTimeoutPromise = new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Database operation timeout after 10 seconds')), 10000)
      );
      
      booksWithoutFiles = await Promise.race([noFilesOperation(), noFilesTimeoutPromise]);
      console.log(`Books without files counted: ${booksWithoutFiles}`);
    } catch (error: unknown) {
      console.error('Error counting books without files:', error);
      console.error('Database error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      booksWithoutFiles = 0;
    }

    // Получаем количество книг в Telegram канале
    let booksInTelegram = 0;
    try {
      console.log('Attempting to initialize Telegram client...');
      
      // Add timeout wrapper for Telegram operations
      const telegramOperation = async () => {
        const telegramClient = await TelegramService.getInstance();
        console.log('Telegram client initialized successfully');
        
        console.log('Attempting to get metadata channel...');
        const channel = await telegramClient.getMetadataChannel();
        console.log('Metadata channel obtained successfully');
        
        console.log('Attempting to get messages from channel...');
        const messages = await telegramClient.getMessages((channel as { id: number | string }).id, 1000);
        console.log(`Messages retrieved successfully, count: ${Array.isArray(messages) ? messages.length : 0}`);
        
        // Log more details about the messages
        if (Array.isArray(messages)) {
          console.log(`First few message IDs: ${messages.slice(0, 5).map((m: unknown) => (m as { id?: unknown }).id || 'undefined').join(', ')}`);
          // Count only messages with text content
          const textMessages = messages.filter((m: unknown) => (m as { text?: unknown }).text);
          console.log(`Messages with text content: ${textMessages.length}`);
          return textMessages.length;
        }
        return 0;
      };
      
      // Wrap in Promise.race with timeout
      const timeoutPromise = new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Telegram operation timeout after 25 seconds')), 25000)
      );
      
      booksInTelegram = await Promise.race([telegramOperation(), timeoutPromise]);
      console.log(`Final booksInTelegram count: ${booksInTelegram}`);
    } catch (error: unknown) {
      console.error('Error counting books in Telegram:', error);
      console.error('Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
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
    
    // Add timeout wrapper for the download operation
    const downloadOperation = async () => {
      return await syncService.downloadFilesFromArchiveChannel(limit, true);
    };
    
    // Wrap in Promise.race with timeout (5 minutes for file downloads)
    const downloadTimeoutPromise = new Promise<unknown[]>((_, reject) => 
      setTimeout(() => reject(new Error('File download operation timeout after 5 minutes')), 300000)
    );
    
    const results = await Promise.race([downloadOperation(), downloadTimeoutPromise]);

    return NextResponse.json({
      message: `Successfully processed ${(results as unknown[]).length} files`,
      files: results,
      progress: 100,
      logs: [`Начало загрузки...`, `Обработано файлов: ${(results as unknown[]).length}`, `Загрузка завершена`]
    });
  } catch (error: unknown) {
    console.error('Error starting download of missing books:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
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