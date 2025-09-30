'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Search, BookOpen, User, LogOut, Settings, Star, Download } from 'lucide-react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Book {
  id: string
  title: string
  author: string
  description?: string
  cover_url?: string
  file_url?: string
  rating?: number
  downloads_count: number
  views_count: number
  series?: {
    title: string
    author: string
  }
}

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

export default function LibraryPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
  const router = useRouter()
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalBooks, setTotalBooks] = useState(0)
  const booksPerPage = 20

  const loadBooks = useCallback(async (page = 1) => {
    try {
      // Сначала получаем общее количество книг
      const { count, error: countError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Error counting books:', countError)
      } else {
        setTotalBooks(count || 0)
      }

      // Затем получаем книги для текущей страницы
      const from = (page - 1) * booksPerPage
      const to = from + booksPerPage - 1

      const { data, error } = await supabase
        .from('books')
        .select(`
          *,
          series:series_id(title, author)
        `)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error loading books:', error)
      } else {
        setBooks(data || [])
      }
    } catch (error) {
      console.error('Error loading books:', error)
    }
  }, [supabase])

  useEffect(() => {
    const getInitialData = async () => {
      try {
        // Получаем сессию пользователя
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          router.push('/auth/login')
          return
        }

        setUser(session.user)

        // Получаем профиль пользователя
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('Profile error:', profileError)
        } else {
          setUserProfile(profile)
        }

        // Получаем книги
        await loadBooks(currentPage)
      } catch (error) {
        console.error('Error loading initial data:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialData()

    // Подписываемся на изменения аутентификации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router, loadBooks, currentPage])

  const searchBooks = async (query: string, page = 1) => {
    if (!query.trim()) {
      await loadBooks(page)
      return
    }

    try {
      // Сначала получаем общее количество книг по запросу
      const { count, error: countError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .or(`title.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`)

      if (countError) {
        console.error('Error counting search results:', countError)
      } else {
        setTotalBooks(count || 0)
      }

      // Затем получаем книги для текущей страницы
      const from = (page - 1) * booksPerPage
      const to = from + booksPerPage - 1

      const { data, error } = await supabase
        .from('books')
        .select(`
          *,
          series:series_id(title, author)
        `)
        .or(`title.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error searching books:', error)
      } else {
        setBooks(data || [])
      }
    } catch (error) {
      console.error('Error searching books:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    searchBooks(searchQuery, 1)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const incrementDownloads = async (bookId: string) => {
    try {
      await supabase.rpc('increment_downloads', { book_id: bookId })
      // Обновляем локальное состояние
      setBooks(books.map(book => 
        book.id === bookId 
          ? { ...book, downloads_count: book.downloads_count + 1 }
          : book
      ))
    } catch (error) {
      console.error('Error incrementing downloads:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Загрузка библиотеки...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Fiction Library
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <User className="h-4 w-4" />
                <span>{userProfile?.display_name || userProfile?.username || user?.email}</span>
                {userProfile?.role === 'admin' && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs">
                    Админ
                  </span>
                )}
              </div>
              
              <button
                onClick={() => router.push('/profile')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск книг по названию, автору или описанию..."
              className="pl-10 pr-4 py-3"
            />
          </div>
        </form>

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                {searchQuery ? 'Книги не найдены' : 'В библиотеке пока нет книг'}
              </p>
            </div>
          ) : (
            books.map((book) => (
              <Card key={book.id} className="flex flex-col h-full">
                {book.cover_url && (
                  <div className="w-full h-48 relative">
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      className="object-cover rounded-t-lg"
                      unoptimized
                    />
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">
                    {book.title}
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {book.author}
                  </p>
                </CardHeader>
                
                <CardContent className="flex-grow pb-4">
                  {book.series && (
                    <p className="text-blue-600 dark:text-blue-400 text-sm mb-2">
                      Серия: {book.series.title}
                    </p>
                  )}
                  
                  {book.description && (
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                      {book.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      {book.rating && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span>{book.rating.toFixed(1)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <Download className="h-4 w-4 mr-1" />
                        <span>{book.downloads_count}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0">
                  {book.file_url && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        incrementDownloads(book.id);
                        window.open(book.file_url, '_blank');
                      }}
                    >
                      Скачать
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          </div>
          
          {/* Pagination */}
          <div className="mt-8 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) {
                        const newPage = currentPage - 1;
                        setCurrentPage(newPage);
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage);
                        } else {
                          loadBooks(newPage);
                        }
                      }
                    }}
                  />
                </PaginationItem>
                
                {/* Отображаем до 5 страниц вокруг текущей */}
                {Array.from({ length: Math.min(5, Math.ceil(totalBooks / booksPerPage)) }, (_, i) => {
                  let page;
                  if (Math.ceil(totalBooks / booksPerPage) <= 5) {
                    // Если всего страниц <= 5, показываем все
                    page = i + 1;
                  } else {
                    // Иначе показываем страницы вокруг текущей
                    const start = Math.max(1, currentPage - 2);
                    page = start + i;
                  }
                  
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink 
                        href="#" 
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(page);
                          if (searchQuery) {
                            searchBooks(searchQuery, page);
                          } else {
                            loadBooks(page);
                          }
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      const totalPages = Math.ceil(totalBooks / booksPerPage);
                      if (currentPage < totalPages) {
                        const newPage = currentPage + 1;
                        setCurrentPage(newPage);
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage);
                        } else {
                          loadBooks(newPage);
                        }
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  )
}
