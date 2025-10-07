import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '@/lib/telegram/sync';
import { MetadataParser } from '@/lib/telegram/parser';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Enhanced duplicate checking function
 * Checks for duplicates based on multiple criteria
 */
async function checkForDuplicates(
  title: string,
  author: string,
  publicationYear?: number
): Promise<{ exists: boolean; book?: { id: string; title: string; author: string; publication_year?: number; file_url?: string; created_at: string; updated_at: string } }> {
  try {
    let query = supabaseAdmin
      .from('books')
      .select('id, title, author, publication_year, file_url, created_at, updated_at')
      .eq('title', title)
      .eq('author', author);
    
    // If publication year is provided, use it for more precise matching
    if (publicationYear) {
      query = query.eq('publication_year', publicationYear);
    }
    
    const { data, error } = await query.limit(1).single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "single row expected" which is expected when no rows found
      console.error('Error checking for duplicates:', error);
      return { exists: false };
    }
    
    return { 
      exists: !!data, 
      book: data || undefined 
    };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { exists: false };
  }
}

async function findBookInDatabase(
  title: string, 
  author: string, 
  publicationYear?: number
): Promise<{ exists: boolean; book?: { id: string; publication_year?: number; file_url?: string } }> {
  try {
    let query = supabaseAdmin
      .from('books')
      .select('id, title, author, publication_year, file_url, created_at, updated_at')
      .eq('title', title)
      .eq('author', author);
    
    // If publication year is provided, use it for more precise matching
    if (publicationYear) {
      query = query.eq('publication_year', publicationYear);
    }
    
    const { data, error } = await query.limit(1).single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "single row expected" which is expected when no rows found
      console.error('Error checking for duplicates:', error);
      return { exists: false };
    }
    
    return { 
      exists: !!data, 
      book: data || undefined 
    };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { exists: false };
  }
}

/**
 * POST /api/admin/sync
 * Запускает синхронизацию метаданных из Telegram канала
 * 
 * Body:
 * - limit: number (опционально, по умолчанию 10) - количество сообщений для синхронизации
 * - channelType: 'metadata' | 'files' (опционально, по умолчанию 'metadata')
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем токен из заголовка
    const token = authHeader.replace('Bearer ', '');
    
    // Проверяем пользователя через Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Получаем параметры из body
    const body = await request.json();
    const limit = body.limit || 10;
    const channelType = body.channelType || 'metadata';

    // Инициализируем сервис синхронизации
    const syncService = await TelegramSyncService.getInstance();

    if (channelType === 'metadata') {
      // Синхронизируем метаданные с правильной логикой возобновления
      console.log('🚀 Запуск синхронизации метаданных (лимит: ' + limit + ')');
      const results = await syncService.syncBooks(limit);
      
      console.log('✅ Синхронизация метаданных завершена:', results);
      
      // Форматируем детали для отображения с автором и названием вместо bookID
      const formattedDetails = results.details.map((detail: any) => {
        // Извлекаем информацию о книге из деталей
        const bookInfo = detail.bookTitle && detail.bookAuthor 
          ? detail.bookAuthor + ' - ' + detail.bookTitle
          : detail.bookId || 'неизвестная книга';
        
        switch (detail.status) {
          case 'added':
            return '✅ Добавлена книга: ' + bookInfo + ' (сообщение ' + detail.msgId + ')';
          case 'updated':
            return '🔄 Обновлена книга: ' + bookInfo + ' (сообщение ' + detail.msgId + ')';
          case 'skipped':
            const reason = detail.reason || 'неизвестная причина';
            // Переводим причины на русский
            let russianReason = reason;
            switch (reason) {
              case 'existing book has better description':
                russianReason = 'у существующей книги лучшее описание';
                break;
              case 'existing book has genres':
                russianReason = 'у существующей книги есть жанры';
                break;
              case 'existing book has tags':
                russianReason = 'у существующей книги есть теги';
                break;
              case 'existing book has cover':
                russianReason = 'у существующей книги есть обложка';
                break;
              case 'existing book has telegram post id':
                russianReason = 'у существующей книги есть ID сообщения';
                break;
              case 'missing title or author':
                russianReason = 'отсутствует название или автор';
                break;
              case 'no text content':
                russianReason = 'сообщение без текста';
                break;
              case 'metadata complete':
                russianReason = 'метаданные полные';
                break;
            }
            return '⚠️ Пропущено: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + russianReason + ')';
          case 'error':
            const error = detail.error || 'неизвестная ошибка';
            return '❌ Ошибка: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + error + ')';
          default:
            return '❓ Неизвестный статус: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + JSON.stringify(detail) + ')';
        }
      });
      
      // Создаем красивый отчет с иконками
      const reportLines = [
        '🚀 Результаты синхронизации метаданных (лимит: ' + limit + ')',
        '📊 Статистика:',
        '   ✅ Успешно обработано: ' + results.processed,
        '   📚 Добавлено книг: ' + results.added,
        '   🔄 Обновлено книг: ' + results.updated,
        '   ⚠️ Пропущено: ' + results.skipped,
        '   ❌ Ошибок: ' + results.errors,
        '', // Пустая строка для разделения
        ...formattedDetails
      ];
      
      return NextResponse.json({
        message: 'Синхронизация завершена',
        results,
        totalProcessed: results.processed,
        actions: reportLines
      });
    } else {
      return NextResponse.json(
        { error: 'File sync not implemented yet' },
        { status: 501 }
      );
    }
  } catch (error) {
    console.error('Sync error:', error);
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
 * GET /api/admin/sync/status
 * Получает статус последней синхронизации
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем статус синхронизации из базы
    const { data: syncStatus, error: statusError } = await supabaseAdmin
      .from('telegram_sync_status')
      .select('*')
      .order('last_sync_at', { ascending: false })
      .limit(5);

    if (statusError) {
      throw statusError;
    }

    // Получаем статистику по книгам
    const { count: totalBooks } = await supabaseAdmin
      .from('books')
      .select('*', { count: 'exact', head: true });

    const { count: totalSeries } = await supabaseAdmin
      .from('series')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      syncHistory: syncStatus || [],
      stats: {
        totalBooks: totalBooks || 0,
        totalSeries: totalSeries || 0,
      },
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

