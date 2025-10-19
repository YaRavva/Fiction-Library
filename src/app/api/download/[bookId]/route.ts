import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'
import { slugify } from '@/lib/slugify'

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

    if (bookError || !bookData || !bookData.file_url) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Загружаем файл с S3
    const response = await fetch(bookData.file_url)

    if (!response.ok) {
      return new NextResponse('Failed to fetch file', { status: response.status })
    }

    const fileContent = await response.arrayBuffer()

    const sanitizedTitle = slugify(bookData.title);
    const sanitizedAuthor = slugify(bookData.author);
    const fileExtension = bookData.file_format && bookData.file_format !== '' ?
      bookData.file_format : 'zip';
    const filename = `${sanitizedAuthor}-${sanitizedTitle}.${fileExtension}`.toLowerCase();

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
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    console.error('Error fetching book content:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
