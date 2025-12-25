'use client'

import { useEffect, useState, Suspense } from 'react'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { getValidSession } from '@/lib/auth-helpers'
import { Book as SupabaseBook } from '@/lib/supabase'
import { EnchantedBackground } from '@/components/enchanted/enchanted-background'
import { EnchantedBookCard } from '@/components/enchanted/enchanted-book-card'
import { EnchantedHeader } from '@/components/enchanted/enchanted-header'

export const dynamic = 'force-dynamic'

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

function EnchantedLibraryContent() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const getInitialData = async () => {
      setLoading(true)
      try {
        const session = await getValidSession(supabase)
        if (!session) {
          router.push('/auth/login')
          return
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setUserProfile(profile)

        const { data, error } = await supabase
          .from('books')
          .select(`
            *,
            series:series_id(id, title, author, series_composition, cover_urls)
          `)
          .order('created_at', { ascending: false })
          .limit(24)

        if (error) {
          console.error('Error loading books:', error)
        } else {
          setBooks(data || [])
          setFilteredBooks(data || [])
        }
      } catch (error) {
        console.error('Error loading initial data:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    getInitialData()
  }, [supabase, router])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredBooks(books)
      return
    }

    const filtered = books.filter(book =>
      book.title?.toLowerCase().includes(query.toLowerCase()) ||
      book.author?.toLowerCase().includes(query.toLowerCase()) ||
      book.description?.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredBooks(filtered)
  }

  const handleDownload = (book: Book) => {
    if (book.file_url) {
      window.location.href = `/api/download/${book.id}`
    }
  }

  const handleRead = (book: Book) => {
    if (book.file_url) {
      router.push(`/reader?bookId=${book.id}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-950 via-slate-900 to-amber-950">
        <div className="text-center">
          <div className="inline-block animate-pulse">
            <svg className="w-16 h-16 text-amber-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <p className="text-amber-200 text-lg font-serif">Открываем врата библиотеки...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Анимированный фон */}
      <EnchantedBackground />

      {/* Контент поверх фона */}
      <div className="relative z-10">
        {/* Заголовок */}
        <EnchantedHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          userProfile={userProfile}
          onLogout={() => router.push('/')}
        />

        {/* Сетка книг */}
        <main className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-4 drop-shadow-2xl">
              Зачарованная Библиотека
            </h1>
            <p className="text-purple-200 text-lg font-serif italic">
              Где живут истории, рождённые мечтой
            </p>
          </div>

          {filteredBooks.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-24 h-24 text-purple-400 mx-auto mb-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <p className="text-purple-300 text-xl font-serif">
                {searchQuery ? 'Книги не найдены в свете магии' : 'Библиотека пока пуста'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredBooks.map((book) => (
                <EnchantedBookCard
                  key={book.id}
                  book={book}
                  onDownload={handleDownload}
                  onRead={handleRead}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function EnchantedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-950 via-slate-900 to-amber-950">
        <div className="text-amber-400 animate-pulse text-xl font-serif">
          Загрузка...
        </div>
      </div>
    }>
      <EnchantedLibraryContent />
    </Suspense>
  )
}
