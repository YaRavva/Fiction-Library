import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * POST /api/admin/clear-file-link
 * Очищает привязку файла к книге
 *
 * Body:
 * - bookId: string (ID книги)
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
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: 'bookId is required' },
        { status: 400 }
      );
    }

    // Проверяем, что книга существует
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    console.log(`🧹 Начинаем очистку привязки файла для книги "${book.title}"...`);

    try {
      // Очищаем привязку файла к книге
      const { data, error } = await supabase
        .from('books')
        .update({
          file_url: null,
          storage_path: null,
          file_size: null,
          file_format: null,
          telegram_file_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookId)
        .select()
        .single();

      if (error) {
        throw new Error(`Ошибка обновления книги: ${error.message}`);
      }

      console.log(`✅ Привязка файла успешно очищена для книги "${book.title}"`);

      return NextResponse.json({
        success: true,
        message: `Привязка файла успешно очищена для книги "${book.title}"`
      });

    } catch (clearError) {
      console.error('Error clearing file link:', clearError);
      return NextResponse.json(
        { error: 'Failed to clear file link for book', details: (clearError as Error).message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in clear-file-link API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}