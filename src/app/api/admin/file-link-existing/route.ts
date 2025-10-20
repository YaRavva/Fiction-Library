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
      
      // Формируем путь к файлу в S3
      const s3Key = fileName;
      const bucketName = process.env.S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error('S3_BUCKET_NAME environment variable is not set.');
      }
      
      // Проверяем, существует ли файл в S3
      let existingFileSize = 0;
      let fileExists = false;
      
      try {
        // Используем S3 сервис для проверки существования файла
        const { headObject } = await import('@/lib/s3-service');
        const fileMetadata = await headObject(s3Key, bucketName);
        if (fileMetadata) {
          existingFileSize = fileMetadata.ContentLength || 0;
          fileExists = true;
          console.log(`✅ Файл ${fileName} найден в S3 с размером ${existingFileSize} байт`);
        }
      } catch (error) {
        // Файл не найден или другая ошибка
        console.log(`❌ Файл ${fileName} не найден в S3:`, (error as Error).message);
        return NextResponse.json(
          { error: 'File not found in storage' },
          { status: 404 }
        );
      }

      if (fileExists) {
        // Загружаем новый файл, чтобы сравнить размеры
        const { buffer: newFileBuffer, fileName: newFileName, mimeType: newMimeType } = await fileLinkService.downloadAndUploadFile(
          fileMessageId,
          channelId,
          book
        );
        
        // Проверяем тип файла
        if (mimeType !== newMimeType) {
          console.log(`⚠️ Тип файла отличается (существующий: ${mimeType}, новый: ${newMimeType}), возвращаем ошибку для повторной загрузки...`);
          return NextResponse.json(
            { error: 'FILE_MISMATCH_NEEDS_REUPLOAD' },
            { status: 422 } // Unprocessable Entity
          );
        } else if (existingFileSize === newFileBuffer.length) {
          console.log(`✅ Тип и размер файла совпадают, привязываем существующий файл...`);
          // Привязываем существующий файл без повторной загрузки
          const result = await fileLinkService.linkExistingFileToBook(
            bookId,
            s3Key,
            fileName,
            mimeType,
            existingFileSize
          );
          
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
        } else {
          console.log(`⚠️ Размер файла отличается (существующий: ${existingFileSize}, новый: ${newFileBuffer.length}), возвращаем ошибку для повторной загрузки...`);
          return NextResponse.json(
            { error: 'FILE_MISMATCH_NEEDS_REUPLOAD' },
            { status: 422 } // Unprocessable Entity
          );
        }
      } else {
        console.log(`❌ Файл ${fileName} не найден в S3`);
        return NextResponse.json(
          { error: 'File not found in storage' },
          { status: 404 }
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