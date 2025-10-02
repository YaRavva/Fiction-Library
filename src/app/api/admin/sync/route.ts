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
      // Синхронизируем метаданные
      const metadata = await syncService.syncMetadata(limit);

      // Сохраняем в базу данных
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const book of metadata) {
        try {
          // Проверяем, существует ли уже серия
          let seriesId: string | null = null;
          
          if (book.series) {
            const { data: existingSeries } = await supabaseAdmin
              .from('series')
              .select('id')
              .eq('title', book.series)
              .eq('author', book.author)
              .single();

            if (existingSeries) {
              seriesId = existingSeries.id;
            } else {
              // Создаем новую серию
              const { data: newSeries, error: seriesError } = await supabaseAdmin
                .from('series')
                .insert({
                  title: book.series,
                  author: book.author,
                  description: book.description,
                  rating: book.rating,
                  genres: book.genres,
                  tags: book.tags,
                  cover_url: book.coverUrls && book.coverUrls.length > 0 ? book.coverUrls[0] : null,
                  cover_urls: book.coverUrls || [],
                  series_composition: book.books || [],
                })
                .select('id')
                .single();

              if (seriesError) {
                console.error('Error creating series:', seriesError);
              } else {
                seriesId = newSeries.id;
              }
            }
          }

          // Проверяем, существует ли книга
          const { data: existingBook } = await supabaseAdmin
            .from('books')
            .select('id')
            .eq('title', book.title)
            .eq('author', book.author)
            .single();

          if (existingBook) {
            // Обновляем существующую книгу
            const updateData: any = {
              series_id: seriesId,
              description: book.description,
              rating: book.rating,
              genres: book.genres,
              tags: book.tags,
              updated_at: new Date().toISOString(),
            };

            // Добавляем обложку, если есть
            if (book.coverUrls && book.coverUrls.length > 0) {
              updateData.cover_url = book.coverUrls[0];
            }

            // Если есть книги в серии, обновляем год первой книги
            if (book.books && book.books.length > 0) {
              updateData.publication_year = book.books[0].year;
            }

            const { error: updateError } = await supabaseAdmin
              .from('books')
              .update(updateData)
              .eq('id', existingBook.id);

            if (updateError) {
              results.failed++;
              results.errors.push(`Failed to update book "${book.title}": ${updateError.message}`);
            } else {
              results.success++;
            }
          } else {
            // Создаем новую книгу
            const insertData: any = {
              series_id: seriesId,
              title: book.title,
              author: book.author,
              description: book.description,
              rating: book.rating,
              genres: book.genres,
              tags: book.tags,
              file_format: 'fb2',
            };

            // Добавляем обложку, если есть
            if (book.coverUrls && book.coverUrls.length > 0) {
              insertData.cover_url = book.coverUrls[0];
            }

            // Если есть книги в серии, добавляем год первой книги
            if (book.books && book.books.length > 0) {
              insertData.publication_year = book.books[0].year;
            }

            const { error: insertError } = await supabaseAdmin
              .from('books')
              .insert(insertData);

            if (insertError) {
              results.failed++;
              results.errors.push(`Failed to insert book "${book.title}": ${insertError.message}`);
            } else {
              results.success++;
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error processing book "${book.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return NextResponse.json({
        message: 'Sync completed',
        results,
        totalProcessed: metadata.length,
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

