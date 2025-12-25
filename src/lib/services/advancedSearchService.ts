import { SupabaseClient } from '@supabase/supabase-js'

// Типы согласно systemPatterns.md
export interface AdvancedSearchFilters {
  query: string
  author: string
  series: string
  genre: string
  minRating: number | null
  maxRating: number | null
  yearFrom: number | null
  yearTo: number | null
  hasFile: boolean | null
  tags: string[]
  sortBy: 'created_at' | 'title' | 'author' | 'rating' | 'downloads_count' | 'views_count'
  sortOrder: 'asc' | 'desc'
}

export interface SearchResult<T> {
  data: T[]
  count: number
  error?: string
}

// Service Layer паттерн для бизнес-логики поиска
export class AdvancedSearchService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Выполняет расширенный поиск книг с фильтрами
   * Следует Repository Pattern через Supabase клиент
   */
  async searchBooks(
    filters: AdvancedSearchFilters,
    page: number = 1,
    limit: number = 10
  ): Promise<SearchResult<any>> {
    try {
      // Строим базовый запрос
      let query = this.supabase
        .from('books')
        .select(`
          *,
          series:series_id(id, title, author, series_composition, cover_urls)
        `, { count: 'exact' })

      // Применяем фильтры согласно бизнес-логике
      query = this.applyFilters(query, filters)

      // Применяем сортировку
      query = this.applySorting(query, filters.sortBy, filters.sortOrder)

      // Применяем пагинацию (если limit не 0)
      if (limit > 0) {
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) {
        console.error('Advanced search error:', error)
        return {
          data: [],
          count: 0,
          error: error.message
        }
      }

      return {
        data: data || [],
        count: count || 0
      }
    } catch (error) {
      console.error('Advanced search service error:', error)
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Применяет фильтры к запросу
   * Инкапсулирует сложную логику фильтрации
   */
  private applyFilters(query: any, filters: AdvancedSearchFilters) {
    // Текстовый поиск по основным полям
    if (filters.query.trim()) {
      query = query.or(`title.ilike.%${filters.query}%,author.ilike.%${filters.query}%,description.ilike.%${filters.query}%`)
    }

    // Фильтр по автору
    if (filters.author.trim()) {
      query = query.ilike('author', `%${filters.author}%`)
    }

    // Фильтр по серии - ищем через связанную таблицу series
    if (filters.series.trim()) {
      // Поиск по названию серии через JOIN
      query = query.or(`series.title.ilike.%${filters.series}%`)
    }

    // Фильтр по жанру
    if (filters.genre.trim()) {
      query = query.contains('genres', [filters.genre])
    }

    // Фильтр по рейтингу
    if (filters.minRating !== null) {
      query = query.gte('rating', filters.minRating)
    }
    if (filters.maxRating !== null) {
      query = query.lte('rating', filters.maxRating)
    }

    // Фильтр по году публикации
    if (filters.yearFrom !== null) {
      query = query.gte('publication_year', filters.yearFrom)
    }
    if (filters.yearTo !== null) {
      query = query.lte('publication_year', filters.yearTo)
    }

    // Фильтр по наличию файла
    if (filters.hasFile !== null) {
      if (filters.hasFile) {
        query = query.not('file_url', 'is', null)
      } else {
        query = query.is('file_url', null)
      }
    }

    // Фильтр по тегам
    if (filters.tags.length > 0) {
      // Создаем условия для каждого тега
      const tagConditions = filters.tags.map(tag => 
        `tags.cs.{${tag}},genres.cs.{${tag}}`
      )
      // Объединяем все условия через OR
      query = query.or(tagConditions.join(','))
    }

    return query
  }

  /**
   * Применяет сортировку к запросу
   */
  private applySorting(query: any, sortBy: string, sortOrder: 'asc' | 'desc') {
    return query.order(sortBy, { ascending: sortOrder === 'asc' })
  }

  /**
   * Получает популярные теги для автодополнения
   */
  async getPopularTags(limit: number = 20): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('books')
        .select('tags, genres')
        .not('tags', 'is', null)
        .not('genres', 'is', null)

      if (error) {
        console.error('Error fetching tags:', error)
        return []
      }

      // Собираем все теги и жанры
      const allTags = new Set<string>()
      
      data?.forEach(book => {
        if (book.tags && Array.isArray(book.tags)) {
          book.tags.forEach((tag: string) => allTags.add(tag))
        }
        if (book.genres && Array.isArray(book.genres)) {
          book.genres.forEach((genre: string) => allTags.add(genre))
        }
      })

      // Возвращаем первые N тегов (в реальном проекте можно добавить подсчет популярности)
      return Array.from(allTags).slice(0, limit)
    } catch (error) {
      console.error('Error in getPopularTags:', error)
      return []
    }
  }

  /**
   * Получает статистику поиска для аналитики
   */
  async getSearchStats(): Promise<{
    totalBooks: number
    booksWithFiles: number
    averageRating: number
    topAuthors: string[]
  }> {
    try {
      // Общее количество книг
      const { count: totalBooks } = await this.supabase
        .from('books')
        .select('*', { count: 'exact', head: true })

      // Книги с файлами
      const { count: booksWithFiles } = await this.supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .not('file_url', 'is', null)

      // Средний рейтинг
      const { data: ratingData } = await this.supabase
        .from('books')
        .select('rating')
        .not('rating', 'is', null)

      const averageRating = ratingData?.length 
        ? ratingData.reduce((sum, book) => sum + (book.rating || 0), 0) / ratingData.length
        : 0

      // Топ авторы (упрощенная версия)
      const { data: authorsData } = await this.supabase
        .from('books')
        .select('author')
        .not('author', 'is', null)
        .limit(100)

      const authorCounts = new Map<string, number>()
      authorsData?.forEach(book => {
        if (book.author) {
          authorCounts.set(book.author, (authorCounts.get(book.author) || 0) + 1)
        }
      })

      const topAuthors = Array.from(authorCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([author]) => author)

      return {
        totalBooks: totalBooks || 0,
        booksWithFiles: booksWithFiles || 0,
        averageRating: Math.round(averageRating * 10) / 10,
        topAuthors
      }
    } catch (error) {
      console.error('Error getting search stats:', error)
      return {
        totalBooks: 0,
        booksWithFiles: 0,
        averageRating: 0,
        topAuthors: []
      }
    }
  }
}