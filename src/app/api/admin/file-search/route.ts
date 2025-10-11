import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * POST /api/admin/file-search
 * Запускает полуавтоматический поиск файлов для книг без файлов
 *
 * Body:
 * - action: 'search' | 'process' | 'auto_process'
 * - bookId?: string (для обработки конкретной книги)
 * - fileMessageId?: number (для обработки конкретного файла)
 * - channelId?: number (ID канала для загрузки файлов)
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabase
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
    const { action, bookId, fileMessageId, channelId = 1515159552 } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'search': {
        // Поиск книг без файлов только в базе данных
        console.log('🔍 Поиск книг без файлов в базе данных...');

        // Получаем статистику по книгам без файлов
        const { count: booksWithoutFiles } = await supabase
          .from('books')
          .select('*', { count: 'exact', head: true })
          .is('file_url', null);

        if (!booksWithoutFiles || booksWithoutFiles === 0) {
          return NextResponse.json({
            message: 'Все книги уже имеют файлы',
            results: [],
            totalBooks: 0
          });
        }

        // Возвращаем только статистику
        return NextResponse.json({
          message: `Найдено ${booksWithoutFiles} книг без файлов. Используйте автообработку для поиска и привязки файлов.`,
          results: [],
          totalBooks: booksWithoutFiles,
          availableFiles: 0
        });
      }

      case 'process': {
        // Обработка конкретной книги - заглушка для будущего
        return NextResponse.json({
          message: 'Обработка конкретной книги будет реализована в следующих версиях',
          error: 'Not implemented yet'
        }, { status: 501 });
      }

      case 'auto_process': {
        // Автообработка - заглушка для будущего
        return NextResponse.json({
          message: 'Автообработка будет реализована в следующих версиях',
          error: 'Not implemented yet'
        }, { status: 501 });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: search, process, or auto_process' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('File search error:', error);
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
 * GET /api/admin/file-search/status
 * Получает статус поиска файлов
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

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем, что пользователь - админ
    const { data: profile, error: profileError } = await supabase
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

    // Получаем статистику по книгам без файлов
    const { count: booksWithoutFiles } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .or('file_url.is.null,file_url.eq.');

    // Получаем статистику по всем книгам
    const { count: totalBooks } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      stats: {
        booksWithoutFiles: booksWithoutFiles || 0,
        totalBooks: totalBooks || 0,
        coveragePercentage: totalBooks ? Math.round(((totalBooks - (booksWithoutFiles || 0)) / totalBooks) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting file search status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}