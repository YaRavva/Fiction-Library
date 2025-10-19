import { NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/serverSupabase'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  const bookId = params.bookId
  const supabase = serverSupabase

  try {
    // Получаем информацию о книге
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('file_url')
      .eq('id', bookId)
      .single()

    if (bookError || !bookData || !bookData.file_url) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Загружаем файл с S3
    const response = await fetch(bookData.file_url)

    if (!response.ok) {
      return new NextResponse('Failed to fetch file', { status: response.status })
    }

    const fileContent = await response.arrayBuffer()

    // Отправляем содержимое файла клиенту
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/zip',
      },
    })
  } catch (error) {
    console.error('Error fetching book content:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
