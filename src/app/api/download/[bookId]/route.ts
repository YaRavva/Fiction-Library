import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'
import { slugifyTitleCase, slugifySentenceCase } from '@/lib/slugify'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  const bookId = params.bookId
  const supabase = serverSupabase

  try {
    // Получаем информацию о книге
    interface BookInfo {
      title: string;
      author: string;
      file_url: string;
      file_format: string;
    }

    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('title, author, file_url, file_format')
      .eq('id', bookId)
      .single<BookInfo>()

    // Проверка на существование bookData
    if (bookError) {
      console.error(`Ошибка при получении данных книги ${bookId}:`, bookError)
      return NextResponse.json(
        { error: 'Книга не найдена', details: bookError.message },
        { status: 404 }
      )
    }

    if (!bookData) {
      console.error(`Книга с ID ${bookId} не найдена в базе данных`)
      return NextResponse.json(
        { error: 'Книга не найдена' },
        { status: 404 }
      )
    }

    if (!bookData.file_url) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Загружаем файл с S3
    const response = await fetch(bookData.file_url)

    if (!response.ok) {
      return new NextResponse('Failed to fetch file', { status: response.status })
    }

    const fileContent = await response.arrayBuffer()

    // Проверяем, есть ли у книги корректные title и author
    const hasValidTitle = bookData.title && bookData.title.trim() !== '';
    const hasValidAuthor = bookData.author && bookData.author.trim() !== '';
    
    let filename: string;
    
    if (hasValidTitle && hasValidAuthor) {
      // Если и title, и author валидны, используем их для формирования имени файла
      // Для автора: все слова с заглавной (Title Case)
      // Для названия: только первое слово с заглавной (Sentence Case)
      const sanitizedTitle = slugifySentenceCase(bookData.title);
      const sanitizedAuthor = slugifyTitleCase(bookData.author);
      const fileExtension = bookData.file_format && bookData.file_format !== '' ?
        bookData.file_format : 'zip';
      filename = `${sanitizedAuthor}-${sanitizedTitle}.${fileExtension}`;
      
      // Проверяем, не оказались ли sanitizedTitle или sanitizedAuthor пустыми после slugify
      if (!sanitizedTitle || !sanitizedAuthor) {
        console.info(`Пустые значения после slugify для книги ${bookId}, используем bookId как имя файла`);
        const fileExtension = bookData.file_format && bookData.file_format !== '' ?
          bookData.file_format : 'zip';
        filename = `${bookId}.${fileExtension}`;
      }
    } else {
      // Если title или author отсутствуют или пустые, используем bookId как имя файла
      console.info(`Отсутствуют title или author для книги ${bookId}, используем bookId как имя файла`);
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
    console.error('Error fetching book content:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
