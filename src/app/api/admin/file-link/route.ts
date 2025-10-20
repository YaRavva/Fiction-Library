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

    // Форматируем информацию о книге для логирования
    const bookInfo = `"${book.title}" автора "${book.author}"`;
    console.log(`🔗 Начинаем привязку файла к книге ${bookInfo}...`);

    try {
      // Используем существующий сервис для получения информации о файле
      const { FileLinkService } = await import('@/lib/file-link-service');
      const fileLinkService = await FileLinkService.getInstance();

      // Получаем информацию о файле без загрузки
      const { fileName, mimeType } = await fileLinkService.getFileInfo(fileMessageId, channelId);
      const bucketName = process.env.S3_BUCKET_NAME;
      if (!bucketName) {
        throw new Error('S3_BUCKET_NAME environment variable is not set.');
      }

      console.log(`🔍 Проверяем наличие файла ${fileName} в S3 бакете...`);

      // Проверяем, существует ли файл в S3
      const s3Key = fileName; // Используем fileName как ключ в S3
      
      // Получаем размер существующего файла из S3
      let existingFileSize = 0;
      let fileExists = false;
      
      try {
        // Используем S3 сервис для проверки существования файла и получения его размера
        const { headObject } = await import('@/lib/s3-service');
        const fileMetadata = await headObject(s3Key, bucketName);
        if (fileMetadata) {
          existingFileSize = fileMetadata.ContentLength || 0;
          fileExists = true;
          console.log(`✅ Файл ${fileName} найден в S3 с размером ${existingFileSize} байт`);
        }
      } catch (error) {
        // Файл не найден или другая ошибка
        console.log(`ℹ️ Файл ${fileName} не найден в S3 (будет загружен новый):`, (error as Error).message);
        fileExists = false;
      }

      if (fileExists) {
        console.log(`🔄 Файл уже существует, проверяем его тип и размер...`);
        
        // Загружаем файл из Telegram во временный буфер для проверки
        const { buffer: newFileBuffer, fileName: newFileName, mimeType: newMimeType } = await fileLinkService.downloadAndUploadFile(
          fileMessageId,
          channelId,
          book
        );
        
        // Проверяем тип файла
        if (mimeType !== newMimeType) {
          console.log(`⚠️ Тип файла отличается (существующий: ${mimeType}, новый: ${newMimeType}), загружаем новый файл...`);
          // Удаляем старый файл и загружаем новый
          const { deleteObject } = await import('@/lib/s3-service');
          await deleteObject(s3Key, bucketName);
          
          // Загружаем новый файл в S3
          await fileLinkService.uploadToStorage(newFileName, newFileBuffer, newMimeType);
          
          // Привязываем новый файл к книге
          const result = await fileLinkService.linkFileToBook(
            bookId,
            newFileName,
            newFileName,
            newFileBuffer.length,
            newMimeType
          );
          
          if (result.success) {
            console.log(`✅ Новый файл успешно привязан к книге ${bookInfo}`);
            return NextResponse.json({
              success: true,
              message: `Новый файл успешно привязан к книге ${bookInfo}`,
              fileUrl: result.fileUrl,
              storagePath: result.storagePath
            });
          } else {
            console.error(`❌ Ошибка привязки нового файла:`, result.error);
            return NextResponse.json(
              { error: result.error || 'Failed to link new file' },
              { status: 500 }
            );
          }
        } else if (existingFileSize === newFileBuffer.length) {
          console.log(`✅ Тип и размер файла совпадают, привязываем существующий файл...`);
          // Привязываем существующий файл без повторной загрузки в S3
          const result = await fileLinkService.linkExistingFileToBook(
            bookId,
            s3Key,
            fileName,
            mimeType,
            existingFileSize
          );
          
          if (result.success) {
            console.log(`✅ Существующий файл успешно привязан к книге ${bookInfo}`);
            return NextResponse.json({
              success: true,
              message: `Существующий файл успешно привязан к книге ${bookInfo}`,
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
          console.log(`⚠️ Размер файла отличается (существующий: ${existingFileSize}, новый: ${newFileBuffer.length}), заменяем файл...`);
          // Удаляем старый файл и загружаем новый
          const { deleteObject } = await import('@/lib/s3-service');
          await deleteObject(s3Key, bucketName);
          
          // Загружаем новый файл в S3
          await fileLinkService.uploadToStorage(newFileName, newFileBuffer, newMimeType);
          
          // Привязываем новый файл к книге
          const result = await fileLinkService.linkFileToBook(
            bookId,
            newFileName,
            newFileName,
            newFileBuffer.length,
            newMimeType
          );
          
          if (result.success) {
            console.log(`✅ Новый файл успешно привязан к книге ${bookInfo}`);
            return NextResponse.json({
              success: true,
              message: `Новый файл успешно привязан к книге ${bookInfo}`,
              fileUrl: result.fileUrl,
              storagePath: result.storagePath
            });
          } else {
            console.error(`❌ Ошибка привязки нового файла:`, result.error);
            return NextResponse.json(
              { error: result.error || 'Failed to link new file' },
              { status: 500 }
            );
          }
        }
      } else {
        console.log(`📥 Файл не найден в S3, загружаем новый файл ${fileName} из канала ${channelId}...`);
        // Если файл не существует, загружаем новый
        const result = await fileLinkService.processFileForBook(fileMessageId, channelId, book);

        if (result.success) {
          console.log(`✅ Файл успешно привязан к книге ${bookInfo}`);

          return NextResponse.json({
            success: true,
            message: `Файл успешно привязан к книге ${bookInfo}`,
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