import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { TelegramSyncService } from '@/lib/telegram/sync';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/admin/sync-files
 * Сканирует канал "Архив для фантастики" и добавляет файлы в очередь загрузки
 * 
 * Body:
 * - limit: number (опционально) - количество сообщений для обработки (по умолчанию 10)
 * - addToQueue: boolean (опционально) - добавлять ли файлы в очередь (по умолчанию true)
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем роль админа
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
    const { limit = 10, addToQueue = true } = body;

    // Запускаем синхронизацию файлов
    const syncService = await TelegramSyncService.getInstance();
    const results = await syncService.downloadFilesFromArchiveChannel(limit, addToQueue);

    return NextResponse.json({
      message: `Successfully processed ${results.length} files`,
      files: results,
    });
  } catch (error) {
    console.error('Error syncing files from archive channel:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}