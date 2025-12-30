'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { Search, BookOpen, User, LogOut, Settings, Star, Download, Shield, Library, LayoutGrid, Grid3X3, Table, X } from 'lucide-react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { BookCardSmallShadix } from '@/components/books/book-card-small-shadix'
import { BooksTable } from '@/components/books/books-table'
import { BookCardLargeShadix } from '@/components/books/book-card-large-shadix'
import { Book as SupabaseBook } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AdvancedSearch, AdvancedSearchFilters } from '@/components/books/advanced-search'
import { PageTransition, ContentTransition, ListTransition } from '@/components/ui/page-transition'
import { AdvancedSearchService } from '@/lib/services/advancedSearchService'

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

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

type ViewMode = 'large-cards' | 'small-cards' | 'table'

function LibraryContent() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalBooks, setTotalBooks] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('large-cards')
  const [advancedSearchService] = useState(() => new AdvancedSearchService(supabase))
  const [isAdvancedSearch, setIsAdvancedSearch] = useState(false)
  
  // Инициализируем viewMode из URL параметра view
  useEffect(() => {
    const viewParam = searchParams.get('view') as ViewMode | null
    if (viewParam && ['large-cards', 'small-cards', 'table'].includes(viewParam)) {
      setViewMode(viewParam)
    }
  }, [searchParams])

  // Инициализируем booksPerPage из URL параметра limit
  const initialLimit = searchParams.get('limit')
  const [booksPerPage, setBooksPerPage] = useState(() => {
    if (initialLimit === 'all') return 0
    const limit = parseInt(initialLimit || '100', 10)
    return isNaN(limit) ? 10 : limit
  })

  // Проверяем, есть ли поисковый запрос в URL
  useEffect(() => {
    const search = searchParams.get('search')
    if (search) {
      setSearchQuery(search)
      searchBooks(search, 1)
    }
  }, [searchParams])

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
      setLoading(true);
      try {
        const session = await getValidSession(supabase);
        if (!session) {
          router.push('/auth/login');
          return;
        }
        setUser(session.user);

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUserProfile(profile);

        await loadBooks(currentPage);
      } catch (error) {
        console.error('Error loading initial data:', error);
        // Optionally handle error state here, e.g., redirect to an error page
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    getInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, loadBooks, currentPage]);

  const searchBooks = useCallback(async (query: string, page = 1) => {
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
            series:series_id(id, title, author, series_composition, cover_urls)
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
            series:series_id(id, title, author, series_composition, cover_urls)
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
  }, [supabase, booksPerPage, loadBooks])

  // Новая функция для поиска по тегам
  const searchBooksByTag = useCallback(async (tag: string, page = 1) => {
    try {
      // Проверяем, является ли тег специальным тегом "#вышеX"
      if (tag.startsWith('выше') && tag.length > 4) {
        const ratingThreshold = parseInt(tag.substring(4));
        if (!isNaN(ratingThreshold)) {
          // Сначала получаем общее количество книг с рейтингом выше порога
          const { count, error: countError } = await supabase
            .from('books')
            .select('*', { count: 'exact', head: true })
            .gte('rating', ratingThreshold);

          if (countError) {
            console.error('Error counting books by rating:', countError);
          } else {
            setTotalBooks(count || 0);
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
              .gte('rating', ratingThreshold)
              .order('rating', { ascending: false });

            if (error) {
              console.error('Error searching books by rating:', error);
            } else {
              setBooks(data || []);
            }
          } else {
            const from = (page - 1) * booksPerPage;
            const to = from + booksPerPage - 1;

            const { data, error } = await supabase
              .from('books')
              .select(`
                *,
                series:series_id(id, title, author, series_composition, cover_urls)
              `)
              .gte('rating', ratingThreshold)
              .order('rating', { ascending: false })
              .range(from, to);

            if (error) {
              console.error('Error searching books by rating:', error);
            } else {
              setBooks(data || []);
            }
          }
          return;
        }
      }

      // Сначала получаем общее количество книг по тегу или жанру
      const { count, error: countError } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .or(`tags.cs.{${tag}},genres.cs.{${tag}}`);

      if (countError) {
        console.error('Error counting books by tag:', countError);
      } else {
        setTotalBooks(count || 0);
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
          .or(`tags.cs.{${tag}},genres.cs.{${tag}}`)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error searching books by tag:', error);
        } else {
          setBooks(data || []);
        }
      } else {
        const from = (page - 1) * booksPerPage;
        const to = from + booksPerPage - 1;

        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
          .or(`tags.cs.{${tag}},genres.cs.{${tag}}`)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('Error searching books by tag:', error);
        } else {
          setBooks(data || []);
        }
      }
    } catch (error) {
      console.error('Error searching books by tag:', error);
    }
  }, [supabase, booksPerPage])

  // Создаем новую функцию для обработки клика по тегу
  const handleTagClick = (tag: string) => {
    // Помещаем тег в поле поиска
    setSearchQuery(`#${tag}`);
    // Выполняем поиск по тегу
    searchBooksByTag(tag, 1);
    // Сбрасываем на первую страницу
    setCurrentPage(1);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    searchBooks(searchQuery, 1)
  }

  const handleAdvancedSearch = useCallback(async (filters: AdvancedSearchFilters) => {
    setLoading(true)
    setIsAdvancedSearch(true)
    setCurrentPage(1)
    
    try {
      const result = await advancedSearchService.searchBooks(filters, 1, booksPerPage === 0 ? 0 : booksPerPage)
      
      if (result.error) {
        console.error('Advanced search error:', result.error)
      } else {
        setBooks(result.data)
        setTotalBooks(result.count)
      }
    } catch (error) {
      console.error('Advanced search failed:', error)
    } finally {
      setLoading(false)
    }
  }, [advancedSearchService, booksPerPage])

  const handleAdvancedSearchReset = useCallback(() => {
    setIsAdvancedSearch(false)
    setSearchQuery('')
    setCurrentPage(1)
    loadBooks(1)
  }, [loadBooks])

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
    // Navigate to the book detail page
    router.push(`/library/book-table?id=${book.id}`)
  }

  const handleDownload = (book: Book) => {
    if (book.file_url) {
      incrementDownloads(book.id);
      window.location.href = `/api/download/${book.id}`;
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
      setBooks(books.map(book => 
        book.id === bookId 
          ? { ...book, views_count: book.views_count + 1 }
          : book
      ))
    } catch (error) {
      console.error('Error incrementing views:', error)
    }
  }

  const handleClearFile = async (bookId: string) => {
    try {
      // Очищаем привязку файла к книге
      const { error } = await supabase
        .from('books')
        .update({
          file_url: null,
          file_size: null,
          file_format: null,
          telegram_file_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookId)

      if (error) {
        console.error('❌ Ошибка при очистке файла:', error)
        alert('Ошибка при очистке файла')
      } else {
        // Обновляем локальное состояние
        setBooks(books.map(book => 
          book.id === bookId 
            ? { 
                ...book, 
                file_url: undefined,
                file_size: undefined,
                file_format: undefined,
                telegram_file_id: undefined
              } as unknown as Book
            : book
        ))
        alert('Файл успешно очищен!')
      }
    } catch (error) {
      console.error('❌ Ошибка:', error)
      alert('Произошла ошибка при очистке файла')
    }
  }

  // Загружаем сохраненный режим отображения при монтировании компонента
  useEffect(() => {
    const savedViewMode = localStorage.getItem('libraryViewMode') as ViewMode | null
    if (savedViewMode) {
      setViewMode(savedViewMode)
    }
  }, [])

  // Сохраняем режим отображения при его изменении
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('libraryViewMode', mode)
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

  // Calculate total pages
  const totalPages = booksPerPage === 0 ? 1 : Math.ceil(totalBooks / booksPerPage)

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6" />
            <span className="text-lg font-semibold">Fiction Library</span>
          </div>
          
          <div className="flex-1 max-w-md mx-4">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск книг, авторов или тегов (#выше5, #фэнтези)..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.display_name || userProfile?.username || user?.email}
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
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Выйти</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Advanced Search */}
        <div className="mb-6">
          <AdvancedSearch
            onSearch={handleAdvancedSearch}
            onReset={handleAdvancedSearchReset}
            isLoading={loading}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">Книг в библиотеке: </div>
            <Badge variant="secondary" className="h-9"> {totalBooks}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">На странице:</span>
              <Select
                value={booksPerPage === 0 ? 'all' : booksPerPage.toString()}
                onValueChange={(value) => {
                  let newBooksPerPage;
                  if (value === 'all') {
                    newBooksPerPage = 0;
                  } else {
                    newBooksPerPage = parseInt(value, 10);
                  }
                  setBooksPerPage(newBooksPerPage);
                  setCurrentPage(1);
                  
                  // Обновляем URL с новым параметром limit
                  const params = new URLSearchParams(searchParams.toString());
                  if (value === 'all') {
                    params.set('limit', 'all');
                  } else {
                    params.set('limit', value);
                  }
                  params.set('page', '1'); // Сбрасываем на первую страницу
                  router.push(`?${params.toString()}`);
                }}
              >
                <SelectTrigger className="w-[80px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="all">Все</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={viewMode}
              onValueChange={(value: ViewMode) => {
                const newViewMode = value as ViewMode;
                setViewMode(newViewMode);
                
                // Обновляем URL с новым параметром view
                const params = new URLSearchParams(searchParams.toString());
                params.set('view', newViewMode);
                router.push(`?${params.toString()}`);
              }}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="large-cards">Большие карточки</SelectItem>
                <SelectItem value="small-cards">Маленькие карточки</SelectItem>
                <SelectItem value="table">Таблица</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Books display */}
        {books.length === 0 && !loading ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Книги не найдены</h3>
            <p className="mt-1 text-muted-foreground">
              {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'В библиотеке пока нет книг'}
            </p>
          </div>
        ) : (
          <>
            <ContentTransition loading={loading}>
              {viewMode === 'table' ? (
                <BooksTable 
                  books={books} 
                  onBookClick={handleBookClick}
                  onDownload={handleDownload}
                  onReadClick={handleRead}
                  onTagClick={handleTagClick}
                />
              ) : viewMode === 'small-cards' ? (
                <ListTransition className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {books.map((book) => (
                    <BookCardSmallShadix
                      key={book.id}
                      book={book}
                      onClick={() => router.push(`/library/book?id=${book.id}`)}
                      onRead={handleRead}
                      onDownload={handleDownload}
                      onTagClick={handleTagClick}
                      onSelect={undefined}
                    />
                  ))}
                </ListTransition>
              ) : (
                <ListTransition className="grid grid-cols-1 gap-6">
                  {books.map((book) => (
                    <BookCardLargeShadix
                      key={book.id}
                      book={book}
                      onDownload={handleDownload}
                      onRead={handleRead}
                      onTagClick={handleTagClick}
                      userProfile={userProfile}
                      onFileClear={handleClearFile}
                    />
                  ))}
                </ListTransition>
              )}
            </ContentTransition>

            {/* Pagination */}
            {booksPerPage > 0 && totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => {
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
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => {
                              setCurrentPage(page);
                              if (searchQuery) {
                                searchBooks(searchQuery, page);
                              } else {
                                loadBooks(page);
                              }
                            }}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => {
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
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </PageTransition>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Library className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка библиотеки...</p>
        </div>
      </div>
    }>
      <LibraryContent />
    </Suspense>
  )
}
