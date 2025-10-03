'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Search, BookOpen, User, LogOut, Settings, Star, Download, Shield, Library, LayoutGrid, Grid3X3, Table, X } from 'lucide-react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getValidSession } from '@/lib/auth-helpers'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ViewModeToggle } from '@/components/books/view-mode-toggle'
import { BookCardSmall } from '@/components/books/book-card-small'
import { BooksTable } from '@/components/books/books-table'
import { BookCardLarge } from '@/components/books/book-card-large'
import { Book as SupabaseBook } from '@/lib/supabase'

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

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

type ViewMode = 'large-cards' | 'small-cards' | 'table'

export default function LibraryPage() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalBooks, setTotalBooks] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('large-cards')
  const [booksPerPage, setBooksPerPage] = useState(100)
  const [customBooksPerPage, setCustomBooksPerPage] = useState('100')

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
      // Если booksPerPage равно 0 ("Все"), то загружаем все книги
      if (booksPerPage === 0) {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading books:', error)
        } else {
          setBooks(data || [])
        }
      } else {
        const from = (page - 1) * booksPerPage
        const to = from + booksPerPage - 1

        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) {
          console.error('Error loading books:', error)
        } else {
          setBooks(data || [])
        }
      }
    } catch (error) {
      console.error('Error loading books:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, booksPerPage])

  useEffect(() => {
    const getInitialData = async () => {
      try {
        // Проверяем и получаем валидную сессию
        const session = await getValidSession(supabase)

        if (!session) {
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
        router.push('/auth/login')
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
      // Проверяем, является ли запрос поиском по тегу (начинается с #)
      if (query.startsWith('#')) {
        const tag = query.substring(1);
        await searchBooksByTag(tag, page);
        return;
      }

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
      // Если booksPerPage равно 0 ("Все"), то загружаем все книги
      if (booksPerPage === 0) {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(title, author)
          `)
          .or(`title.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error searching books:', error)
        } else {
          setBooks(data || [])
        }
      } else {
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
      }
    } catch (error) {
      console.error('Error searching books:', error)
    }
  }

  // Новая функция для поиска по тегам
  const searchBooksByTag = async (tag: string, page = 1) => {
    try {
      // Сначала получаем общее количество книг по тегу или жанру
      const { count, error: countError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .or(`tags.cs.{${tag}},genres.cs.{${tag}}`)

      if (countError) {
        console.error('Error counting books by tag:', countError)
      } else {
        setTotalBooks(count || 0)
      }

      // Затем получаем книги для текущей страницы
      // Если booksPerPage равно 0 ("Все"), то загружаем все книги
      if (booksPerPage === 0) {
        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(title, author)
          `)
          .or(`tags.cs.{${tag}},genres.cs.{${tag}}`)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error searching books by tag:', error)
        } else {
          setBooks(data || [])
          setSearchQuery(`#${tag}`)
          setCurrentPage(1)
        }
      } else {
        const from = (page - 1) * booksPerPage
        const to = from + booksPerPage - 1

        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(title, author)
          `)
          .or(`tags.cs.{${tag}},genres.cs.{${tag}}`)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (error) {
          console.error('Error searching books by tag:', error)
        } else {
          setBooks(data || [])
          setSearchQuery(`#${tag}`)
          setCurrentPage(page)
        }
      }
    } catch (error) {
      console.error('Error searching books by tag:', error)
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

  const handleBookClick = (book: Book) => {
    // TODO: Implement book detail view
    console.log('Book clicked:', book)
  }

  const handleDownloadClick = (book: Book) => {
    if (book.file_url) {
      incrementDownloads(book.id)
      window.open(book.file_url, '_blank')
    }
  }

  const handleDownload = (bookId: string, fileUrl: string | undefined) => {
    if (fileUrl) {
      incrementDownloads(bookId)
      window.open(fileUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Library className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка библиотеки...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/library" className="mr-6 flex items-center space-x-2">
              <Library className="h-6 w-6" />
              <span className="hidden font-bold sm:inline-block">
                Fiction Library
              </span>
            </a>
          </div>

          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Search будет ниже */}
            </div>

            <nav className="flex items-center gap-2">
              {userProfile?.role === 'admin' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/admin')}
                  title="Админ панель"
                >
                  <Shield className="h-5 w-5" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {(userProfile?.display_name || userProfile?.username || user?.email || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userProfile?.display_name || userProfile?.username || 'Пользователь'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userProfile?.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Админ панель</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Настройки</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-6">
        {/* Top Controls Row - Search, Stats, View Mode */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Search */}
          <div className="w-full max-w-md">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск книг по названию, автору или описанию..."
                className="pl-10 pr-10 w-full"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                    loadBooks(1)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>

          {/* Stats and View Mode Toggle */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-grow">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                {searchQuery ? (
                  <span>Найдено книг: </span>
                ) : (
                  <span>Всего книг: </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-sm font-normal"
                  onClick={() => {
                    // Можно добавить функционал при клике на общее количество книг
                  }}
                >
                  <strong>{totalBooks}</strong>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Показывать по:</span>
                <div className="flex gap-1">
                  {[10, 50, 100].map((count) => (
                    <Button
                      key={count}
                      variant={booksPerPage === count ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => {
                        setBooksPerPage(count)
                        setCustomBooksPerPage(count.toString())
                        setCurrentPage(1)
                        if (searchQuery) {
                          searchBooks(searchQuery, 1)
                        } else {
                          loadBooks(1)
                        }
                      }}
                    >
                      {count}
                    </Button>
                  ))}
                  <Button
                    variant={booksPerPage === 0 ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setBooksPerPage(0)
                      setCustomBooksPerPage('Все')
                      setCurrentPage(1)
                      if (searchQuery) {
                        searchBooks(searchQuery, 1)
                      } else {
                        loadBooks(1)
                      }
                    }}
                  >
                    Все
                  </Button>
                </div>
              </div>
            </div>
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* Pagination */}
        {totalBooks > (booksPerPage || totalBooks) && booksPerPage !== 0 && (
          <div className="flex justify-center mb-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (currentPage > 1) {
                        const newPage = currentPage - 1
                        setCurrentPage(newPage)
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage)
                        } else {
                          loadBooks(newPage)
                        }
                      }
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Назад
                  </PaginationPrevious>
                </PaginationItem>

                {Array.from({ length: Math.min(5, Math.ceil(totalBooks / booksPerPage)) }, (_, i) => {
                  let page
                  if (Math.ceil(totalBooks / booksPerPage) <= 5) {
                    page = i + 1
                  } else {
                    const start = Math.max(1, currentPage - 2)
                    page = start + i
                  }

                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                          if (searchQuery) {
                            searchBooks(searchQuery, page)
                          } else {
                            loadBooks(page)
                          }
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      const totalPages = Math.ceil(totalBooks / booksPerPage)
                      if (currentPage < totalPages) {
                        const newPage = currentPage + 1
                        setCurrentPage(newPage)
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage)
                        } else {
                          loadBooks(newPage)
                        }
                      }
                    }}
                    className={currentPage === Math.ceil(totalBooks / booksPerPage) ? "pointer-events-none opacity-50" : ""}
                  >
                    Вперед
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Books Display */}
        <div>

          {books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'Книги не найдены' : 'В библиотеке пока нет книг'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Книги появятся после синхронизации с Telegram'}
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'large-cards' && (
                <div className="grid gap-6 sm:grid-cols-1">
                  {books.map((book) => (
                    <BookCardLarge 
                      key={book.id} 
                      book={book} 
                      onDownload={handleDownload}
                      onTagClick={searchBooksByTag}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'small-cards' && (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {books.map((book) => (
                    <BookCardSmall 
                      key={book.id} 
                      book={book} 
                      onClick={() => handleBookClick(book)} 
                      onTagClick={searchBooksByTag}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'table' && (
                <BooksTable 
                  books={books} 
                  onBookClick={handleBookClick}
                  onDownloadClick={handleDownloadClick}
                  onReadClick={handleBookClick}
                  onTagClick={searchBooksByTag}
                />
              )}
            </>
          )}

          
        </div>

        {/* Bottom Pagination */}
        {totalBooks > (booksPerPage || totalBooks) && booksPerPage !== 0 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (currentPage > 1) {
                        const newPage = currentPage - 1
                        setCurrentPage(newPage)
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage)
                        } else {
                          loadBooks(newPage)
                        }
                      }
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Назад
                  </PaginationPrevious>
                </PaginationItem>

                {Array.from({ length: Math.min(5, Math.ceil(totalBooks / booksPerPage)) }, (_, i) => {
                  let page
                  if (Math.ceil(totalBooks / booksPerPage) <= 5) {
                    page = i + 1
                  } else {
                    const start = Math.max(1, currentPage - 2)
                    page = start + i
                  }

                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                          if (searchQuery) {
                            searchBooks(searchQuery, page)
                          } else {
                            loadBooks(page)
                          }
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      const totalPages = Math.ceil(totalBooks / booksPerPage)
                      if (currentPage < totalPages) {
                        const newPage = currentPage + 1
                        setCurrentPage(newPage)
                        if (searchQuery) {
                          searchBooks(searchQuery, newPage)
                        } else {
                          loadBooks(newPage)
                        }
                      }
                    }}
                    className={currentPage === Math.ceil(totalBooks / booksPerPage) ? "pointer-events-none opacity-50" : ""}
                  >
                    Вперед
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}