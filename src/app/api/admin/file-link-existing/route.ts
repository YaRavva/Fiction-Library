import { NextRequest, NextResponse } from 'next/server';

// Используем service role key для админских операций
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * POST /api/admin/file-link-existing
 * Привязывает уже существующий файл в storage к книге
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

    console.log(`🔗 Начинаем привязку существующего файла к книге "${book.title}"...`);

    try {
      // Используем существующий сервис для получения информации о файле
      const { FileLinkService } = await import('@/lib/file-link-service');
      const fileLinkService = await FileLinkService.getInstance();

      // Получаем информацию о файле без загрузки
      const { fileName, mimeType } = await fileLinkService.getFileInfo(fileMessageId, channelId);
      
      // Формируем путь к файлу в storage (как в file-service.ts)
      const storagePath = `books/${fileName}`;
      
      // Проверяем, существует ли файл в storage
      const { data: existingFile, error: storageError } = await supabase.storage
        .from('books')
        .list('books', {
          search: fileName
        });

      if (storageError || !existingFile || existingFile.length === 0) {
        return NextResponse.json(
          { error: 'File not found in storage' },
          { status: 404 }
        );
      }

      // Предварительная проверка типа файла и размера
      const file = existingFile[0];
      const fileSize = file.metadata?.size || 0;
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      // Проверка допустимых форматов файлов
      const allowedFormats = ['fb2', 'zip'];
      if (!fileExtension || !allowedFormats.includes(fileExtension)) {
        // Удаляем файл из storage
        await supabase.storage.from('books').remove([storagePath]);
        return NextResponse.json(
          { error: `Недопустимый формат файла: ${fileExtension}. Разрешены только: fb2, zip` },
          { status: 400 }
        );
      }

      // Проверка размера файла (минимальный размер для fb2 - 100 байт, для zip - 1000 байт)
      if (fileExtension === 'fb2' && fileSize < 100) {
        // Удаляем файл из storage
        await supabase.storage.from('books').remove([storagePath]);
        return NextResponse.json(
          { error: `Файл fb2 слишком маленький: ${fileSize} байт. Минимальный размер: 100 байт` },
          { status: 400 }
        );
      }
      
      if (fileExtension === 'zip' && fileSize < 1000) {
        // Удаляем файл из storage
        await supabase.storage.from('books').remove([storagePath]);
        return NextResponse.json(
          { error: `Файл zip слишком маленький: ${fileSize} байт. Минимальный размер: 1000 байт` },
          { status: 400 }
        );
      }

      console.log(`✅ Файл найден в storage: ${storagePath}`);

      // Привязываем существующий файл к книге
      const result = await fileLinkService.linkExistingFileToBook(
        bookId,
        storagePath,
        fileName,
        mimeType
      );

      // Если файл не соответствует ожиданиям, возвращаем специальную ошибку
      if (!result.success && result.error === 'FILE_MISMATCH_NEEDS_REUPLOAD') {
        return NextResponse.json(
          { error: 'FILE_MISMATCH_NEEDS_REUPLOAD' },
          { status: 422 } // Unprocessable Entity
        );
      }

      if (result.success) {
        console.log(`✅ Существующий файл успешно привязан к книге "${book.title}"`);

        return NextResponse.json({
          success: true,
          message: `Существующий файл успешно привязан к книге "${book.title}"`,
          fileUrl: result.fileUrl,
          storagePath: result.storagePath
        });
      } else {
        console.error(`❌ Ошибка привязки существующего файла:`, result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to link existing file' },
          { status: 500 }
        );
      }

    } catch (linkError) {
      console.error('Error linking existing file:', linkError);
      return NextResponse.json(
        { error: 'Failed to link existing file to book', details: (linkError as Error).message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in file-link-existing API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}