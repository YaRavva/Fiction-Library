import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'
import { slugifyTitleCase, slugifySentenceCase } from '@/lib/slugify'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } | Promise<{ bookId: string }> }
) {
  const supabase = serverSupabase

  try {
    // В Next.js 15+ params может быть промисом, обрабатываем оба случая
    let bookId: string;
    if (params instanceof Promise) {
      const resolvedParams = await params;
      bookId = resolvedParams.bookId;
    } else {
      bookId = params.bookId;
    }
    
    console.log(`[Download API] Request for book ID: ${bookId}`);
    // Получаем информацию о книге
    interface BookInfo {
      title: string;
      author: string;
      file_url: string;
      file_format: string;
    }

    console.log(`[Download API] Fetching book data for ID: ${bookId}`);
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('title, author, file_url, file_format')
      .eq('id', bookId)
      .single<BookInfo>()

    // Проверка на существование bookData
    if (bookError) {
      console.error(`[Download API] Ошибка при получении данных книги ${bookId}:`, bookError)
      return NextResponse.json(
        { error: 'Книга не найдена', details: bookError.message },
        { status: 404 }
      )
    }

    if (!bookData) {
      console.error(`[Download API] Книга с ID ${bookId} не найдена в базе данных`)
      return NextResponse.json(
        { error: 'Книга не найдена' },
        { status: 404 }
      )
    }

    console.log(`[Download API] Book data retrieved:`, {
      title: bookData.title,
      author: bookData.author,
      file_format: bookData.file_format,
      has_file_url: !!bookData.file_url
    });

    if (!bookData.file_url) {
      console.error(`[Download API] File URL is missing for book ${bookId}`);
      return NextResponse.json(
        { error: 'File not found', bookId },
        { status: 404 }
      )
    }

    // Загружаем файл с S3
    console.log(`[Download API] Fetching file from: ${bookData.file_url}`);
    const response = await fetch(bookData.file_url)

    if (!response.ok) {
      console.error(`[Download API] Failed to fetch file: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch file', status: response.status },
        { status: response.status }
      )
    }

    console.log(`[Download API] File fetched successfully, converting to ArrayBuffer...`);
    const fileContent = await response.arrayBuffer()
    console.log(`[Download API] File content size: ${fileContent.byteLength} bytes`);

    // Проверяем, есть ли у книги корректные title и author
    const hasValidTitle = bookData.title && bookData.title.trim() !== '';
    const hasValidAuthor = bookData.author && bookData.author.trim() !== '';
    
    console.log(`[Download API] Validating title and author:`, {
      hasValidTitle,
      hasValidAuthor,
      title: bookData.title,
      author: bookData.author
    });
    
    let filename: string;
    
    try {
      if (hasValidTitle && hasValidAuthor) {
        // Если и title, и author валидны, используем их для формирования имени файла
        // Для автора: все слова с заглавной (Title Case)
        // Для названия: только первое слово с заглавной (Sentence Case)
        console.log(`[Download API] Applying slugify functions...`);
        const sanitizedTitle = slugifySentenceCase(bookData.title);
        const sanitizedAuthor = slugifyTitleCase(bookData.author);
        const fileExtension = bookData.file_format && bookData.file_format !== '' ?
          bookData.file_format : 'zip';
        filename = `${sanitizedAuthor}-${sanitizedTitle}.${fileExtension}`;
        
        console.log(`[Download API] Slugify results:`, {
          originalTitle: bookData.title,
          sanitizedTitle,
          originalAuthor: bookData.author,
          sanitizedAuthor,
          filename
        });
        
        // Проверяем, не оказались ли sanitizedTitle или sanitizedAuthor пустыми после slugify
        if (!sanitizedTitle || !sanitizedAuthor) {
          console.warn(`[Download API] Пустые значения после slugify для книги ${bookId}, используем bookId как имя файла`);
          const fileExtension = bookData.file_format && bookData.file_format !== '' ?
            bookData.file_format : 'zip';
          filename = `${bookId}.${fileExtension}`;
        }
      } else {
        // Если title или author отсутствуют или пустые, используем bookId как имя файла
        console.warn(`[Download API] Отсутствуют title или author для книги ${bookId}, используем bookId как имя файла`);
        const fileExtension = bookData.file_format && bookData.file_format !== '' ?
          bookData.file_format : 'zip';
        filename = `${bookId}.${fileExtension}`;
      }
    } catch (slugifyError) {
      console.error(`[Download API] Error in slugify:`, slugifyError);
      const fileExtension = bookData.file_format && bookData.file_format !== '' ?
        bookData.file_format : 'zip';
      filename = `${bookId}.${fileExtension}`;
    }

    // Обновляем счетчик скачиваний в базе данных
    try {
      // Вызываем функцию increment_downloads для обновления счетчика скачиваний
      const { error: incrementError } = await supabase.rpc('increment_downloads', {
        book_id: bookId
      } as any); // Используем тип any для обхода проблемы с типизацией
      
      if (incrementError) {
        console.error('Error incrementing download count:', incrementError);
        // Не прерываем скачивание, если ошибка обновления счетчика
      }
    } catch (incrementError) {
      console.error('Error calling increment_downloads function:', incrementError);
      // Не прерываем скачивание, если ошибка обновления счетчика
    }

    // Отправляем содержимое файла клиенту
    // Используем RFC 5987 для правильной поддержки кириллицы в именах файлов
    // Экранируем имя файла для использования в заголовке
    const safeFilename = filename.replace(/"/g, '\\"');
    const encodedFilename = encodeURIComponent(filename);
    const utf8Filename = `UTF-8''${encodedFilename}`;
    // Используем оба формата: filename для совместимости (в кавычках), filename* для UTF-8
    const contentDisposition = `attachment; filename="${safeFilename}"; filename*=${utf8Filename}`;
    
    console.log(`[Download API] Book ID: ${bookId}, Generated filename: "${filename}"`);
    console.log(`[Download API] Content-Disposition: ${contentDisposition}`);
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition,
      },
    })
  } catch (error) {
    console.error(`[Download API] Error fetching book content for ${bookId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Download API] Error details:`, { errorMessage, errorStack });
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: errorMessage,
        bookId: bookId
      },
      { status: 500 }
    );
  }
}
