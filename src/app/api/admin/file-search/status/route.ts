import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
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
      .is('file_url', null);

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