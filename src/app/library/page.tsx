'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Search, BookOpen, User, LogOut, Settings, Star, Download, Shield, Library } from 'lucide-react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  genres?: string[]
  tags?: string[]
  publication_year?: number
  series_id?: string
  series_order?: number
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
          series:series_id(id, title, author, series_composition, cover_urls)
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
    } finally {
      setLoading(false)
    }
  }, [supabase])

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
        {/* Search */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск книг по названию, автору или описанию..."
              className="pl-10"
            />
          </form>
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {searchQuery ? (
              <span>Найдено книг: <strong>{totalBooks}</strong></span>
            ) : (
              <span>Всего книг: <strong>{totalBooks}</strong></span>
            )}
          </div>
        </div>

        {/* Books Grid */}
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
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              {books.map((book) => {
                const ratingTag = book.rating ? `#выше${Math.floor(book.rating)}` : null
                const seriesComposition = book.series?.series_composition
                const seriesCoverUrls = book.series?.cover_urls

                return (
                  <Card key={book.id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Автор и Название */}
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-semibold">Автор:</span> {book.author}
                          </div>
                          <div className="text-sm">
                            <span className="font-semibold">Название:</span> {book.title}
                          </div>
                        </div>

                        {/* Жанр */}
                        {book.genres && book.genres.length > 0 && (
                          <div className="text-sm">
                            <span className="font-semibold">Жанр:</span>{' '}
                            <span className="inline-flex flex-wrap gap-1">
                              {book.genres.map((genre, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80"
                                >
                                  #{genre}
                                </Badge>
                              ))}
                            </span>
                          </div>
                        )}

                        {/* Рейтинг */}
                        {book.rating && (
                          <div className="text-sm">
                            <span className="font-semibold">Рейтинг:</span> {book.rating.toFixed(2)}{' '}
                            {ratingTag && (
                              <Badge variant="secondary" className="text-xs">
                                {ratingTag}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Описание */}
                        {book.description && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {book.description}
                          </p>
                        )}

                        {/* Состав серии */}
                        {seriesComposition && seriesComposition.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold">Состав:</div>
                            <ol className="text-sm space-y-1 list-decimal list-inside">
                              {seriesComposition.map((item, idx) => (
                                <li key={idx}>
                                  {item.title} ({item.year})
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Обложки - только внизу карточки */}
                        {(book.cover_url || (seriesCoverUrls && seriesCoverUrls.length > 0)) && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 gap-2">
                              {/* Если есть обложки серии, показываем их */}
                              {seriesCoverUrls && seriesCoverUrls.length > 0 ? (
                                seriesCoverUrls.map((coverUrl, idx) => (
                                  <div
                                    key={idx}
                                    className="relative w-full max-w-xs mx-auto aspect-[2/3] overflow-hidden rounded border bg-muted"
                                  >
                                    <Image
                                      src={coverUrl}
                                      alt={`Обложка ${idx + 1}`}
                                      fill
                                      className="object-contain"
                                      unoptimized
                                      sizes="(max-width: 640px) 100vw, 320px"
                                    />
                                  </div>
                                ))
                              ) : (
                                // Если нет обложек серии, но есть обложка книги, показываем её
                                book.cover_url && (
                                  <div className="relative w-full max-w-xs mx-auto aspect-[2/3] overflow-hidden rounded border bg-muted">
                                    <Image
                                      src={book.cover_url}
                                      alt={book.title}
                                      fill
                                      className="object-contain"
                                      unoptimized
                                      sizes="(max-width: 640px) 100vw, 320px"
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Кнопка скачивания */}
                        {book.file_url && (
                          <Button
                            className="w-full"
                            onClick={() => {
                              incrementDownloads(book.id)
                              window.open(book.file_url, '_blank')
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Скачать
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalBooks > booksPerPage && (
            <div className="mt-8">
              <Separator className="mb-8" />
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
                    />
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
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}