import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * POST /api/admin/file-link
 * Загружает файл из Telegram и привязывает его к книге
 *
 * Body:
 * - bookId: string (ID книги)
 * - fileMessageId: number (ID сообщения с файлом в Telegram)
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
    const { bookId, fileMessageId, channelId = 1515159552 } = body;

    if (!bookId || !fileMessageId) {
      return NextResponse.json(
        { error: 'bookId and fileMessageId are required' },
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

    console.log(`🔗 Начинаем привязку файла к книге "${book.title}"...`);

    try {
      // Используем существующий сервис для загрузки файла
      const { FileLinkService } = await import('@/lib/file-link-service');
      const fileLinkService = await FileLinkService.getInstance();

      console.log(`📥 Загружаем файл ${fileMessageId} из канала ${channelId}...`);
      const result = await fileLinkService.processFileForBook(fileMessageId, channelId, book);

      if (result.success) {
        console.log(`✅ Файл успешно привязан к книге "${book.title}"`);

        return NextResponse.json({
          success: true,
          message: `Файл успешно привязан к книге "${book.title}"`,
          fileUrl: result.fileUrl,
          storagePath: result.storagePath
        });
      } else {
        console.error(`❌ Ошибка привязки файла:`, result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to link file' },
          { status: 500 }
        );
      }

    } catch (linkError) {
      console.error('Error linking file:', linkError);
      return NextResponse.json(
        { error: 'Failed to link file to book', details: (linkError as Error).message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in file-link API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}