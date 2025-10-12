'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { BookCardLarge } from '@/components/books/book-card-large'
import { Button } from '@/components/ui/button'
import { Book as SupabaseBook } from '@/lib/supabase'
import Head from 'next/head'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Расширяем тип Book из supabase дополнительными полями
interface Book extends SupabaseBook {
  series?: {
    id: string
    title: string
    author: string
    series_composition?: { title: string; year: number }[]
    cover_urls?: string[]
  }
}

function BookTableContent() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookId = searchParams.get('id')
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBook = async () => {
      if (!bookId) {
        router.push('/library')
        return
      }

      try {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
          .eq('id', bookId)
          .single()

        if (error) {
          console.error('Error loading book:', error)
          router.push('/library')
        } else {
          setBook(data)
        }
      } catch (error) {
        console.error('Error loading book:', error)
        router.push('/library')
      } finally {
        setLoading(false)
      }
    }

    loadBook()
  }, [bookId, router, supabase])

  const handleDownload = (bookId: string, fileUrl: string | undefined) => {
    if (fileUrl) {
      // Find the book to get its title and author
      if (book) {
        // Create a custom filename in the format "author - title.ext"
        // Use the actual file format instead of defaulting to .zip
        const sanitizedTitle = book.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const sanitizedAuthor = book.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        // Get the file extension from the storage_path or file_format field
        const fileExtension = book.file_format && book.file_format !== '' ? 
          book.file_format : 
          (book.storage_path ? book.storage_path.split('.').pop() : 'zip');
        const filename = `${sanitizedAuthor} - ${sanitizedTitle}.${fileExtension}`;
        
        // Fetch the file and trigger download with custom filename
        fetch(fileUrl)
          .then(response => response.blob())
          .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          })
          .catch(error => {
            console.error('Error downloading file:', error);
            // Fallback to opening in new tab if download fails
            window.open(fileUrl, '_blank');
          });
      }
    }
  }

  const handleRead = (book: Book) => {
    if (book.file_url) {
      // Увеличиваем счетчик просмотров
      incrementViews(book.id);
      // Переходим к читалке
      router.push(`/reader?bookId=${book.id}`);
    }
  }

  const incrementViews = async (bookId: string) => {
    try {
      await supabase.rpc('increment_views', { book_id: bookId })
      // Обновляем локальное состояние
      if (book && book.id === bookId) {
        setBook({ ...book, views_count: book.views_count + 1 })
      }
    } catch (error) {
      console.error('Error incrementing views:', error)
    }
  }

  const incrementDownloads = async (bookId: string) => {
    try {
      await supabase.rpc('increment_downloads', { book_id: bookId })
      // Обновляем локальное состояние
      if (book && book.id === bookId) {
        setBook({ ...book, downloads_count: book.downloads_count + 1 })
      }
    } catch (error) {
      console.error('Error incrementing downloads:', error)
    }
  }

  // Создаем новую функцию для обработки клика по тегу
  const handleTagClick = (tag: string) => {
    // Переходим к библиотеке с поисковым запросом по тегу
    router.push(`/library?search=#${tag}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Загрузка книги...</p>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Книга не найдена</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Head>
        <title>{book.author} - {book.title} | Fiction Library</title>
      </Head>
      
      <div className="max-w-3xl mx-auto">
        <BookCardLarge 
          book={book} 
          onDownload={handleDownload}
          onRead={handleRead}
          onTagClick={handleTagClick}
        />
        
        <div className="flex justify-center mt-6">
          <Button onClick={() => router.push('/library')} variant="outline">
            Вернуться в библиотеку
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function BookTablePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка книги...</p>
        </div>
      </div>
    }>
      <BookTableContent />
    </Suspense>
  )
}