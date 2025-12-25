'use client'

import { useState, useCallback } from 'react'
import { Search, Filter, X, Calendar, Star, BookOpen, User, Tag, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

interface AdvancedSearchProps {
  onSearch: (filters: AdvancedSearchFilters) => void
  onReset: () => void
  isLoading?: boolean
  className?: string
}

// Компонент следует паттернам из systemPatterns.md
export function AdvancedSearch({ 
  onSearch, 
  onReset, 
  isLoading = false, 
  className = '' 
}: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    query: '',
    author: '',
    series: '',
    genre: '',
    minRating: null,
    maxRating: null,
    yearFrom: null,
    yearTo: null,
    hasFile: null,
    tags: [],
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  const handleFilterChange = useCallback((key: keyof AdvancedSearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const handleTagAdd = useCallback((tag: string) => {
    if (tag.trim() && !filters.tags.includes(tag.trim())) {
      setFilters(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }))
    }
  }, [filters.tags])

  const handleTagRemove = useCallback((tagToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    onSearch(filters)
  }, [filters, onSearch])

  const handleReset = useCallback(() => {
    const resetFilters: AdvancedSearchFilters = {
      query: '',
      author: '',
      series: '',
      genre: '',
      minRating: null,
      maxRating: null,
      yearFrom: null,
      yearTo: null,
      hasFile: null,
      tags: [],
      sortBy: 'created_at',
      sortOrder: 'desc'
    }
    setFilters(resetFilters)
    onReset()
  }, [onReset])

  // Подсчет активных фильтров для UI
  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'query' || key === 'sortBy' || key === 'sortOrder') return count
    if (Array.isArray(value)) return count + value.length
    if (value !== null && value !== '') return count + 1
    return count
  }, 0)

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <Button 
          variant="ghost" 
          className="w-full justify-between p-0 h-auto"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Расширенный поиск
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReset()
                }}
                className="h-6 px-2 text-xs"
              >
                Сбросить
              </Button>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </Button>
        
        {isOpen && (
          <div className="space-y-4 pt-4">
            <CardContent className="p-0">
              <form onSubmit={handleSearch} className="space-y-4">
                {/* Основной поиск */}
                <div className="space-y-2">
                  <Label htmlFor="query" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Поиск по тексту
                  </Label>
                  <Input
                    id="query"
                    placeholder="Название, автор, описание..."
                    value={filters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                  />
                </div>

                <Separator />

                {/* Фильтры по полям */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="author" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Автор
                    </Label>
                    <Input
                      id="author"
                      placeholder="Имя автора"
                      value={filters.author}
                      onChange={(e) => handleFilterChange('author', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="series" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Серия
                    </Label>
                    <Input
                      id="series"
                      placeholder="Название серии"
                      value={filters.series}
                      onChange={(e) => handleFilterChange('series', e.target.value)}
                    />
                  </div>
                </div>

                {/* Рейтинг */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Рейтинг
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="minRating" className="text-xs text-muted-foreground">
                        От
                      </Label>
                      <Select
                        value={filters.minRating?.toString() || 'any'}
                        onValueChange={(value) => 
                          handleFilterChange('minRating', value === 'any' ? null : parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Мин" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Любой</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
                            <SelectItem key={rating} value={rating.toString()}>
                              {rating}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="maxRating" className="text-xs text-muted-foreground">
                        До
                      </Label>
                      <Select
                        value={filters.maxRating?.toString() || 'any'}
                        onValueChange={(value) => 
                          handleFilterChange('maxRating', value === 'any' ? null : parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Макс" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Любой</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
                            <SelectItem key={rating} value={rating.toString()}>
                              {rating}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Год публикации */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Год публикации
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="yearFrom" className="text-xs text-muted-foreground">
                        С
                      </Label>
                      <Input
                        id="yearFrom"
                        type="number"
                        placeholder="1900"
                        min="1900"
                        max={new Date().getFullYear()}
                        value={filters.yearFrom || ''}
                        onChange={(e) => 
                          handleFilterChange('yearFrom', e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="yearTo" className="text-xs text-muted-foreground">
                        По
                      </Label>
                      <Input
                        id="yearTo"
                        type="number"
                        placeholder={new Date().getFullYear().toString()}
                        min="1900"
                        max={new Date().getFullYear()}
                        value={filters.yearTo || ''}
                        onChange={(e) => 
                          handleFilterChange('yearTo', e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Наличие файла */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Наличие файла
                  </Label>
                  <Select
                    value={filters.hasFile === null ? 'any' : filters.hasFile.toString()}
                    onValueChange={(value) => 
                      handleFilterChange('hasFile', value === 'any' ? null : value === 'true')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Любые книги" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Любые книги</SelectItem>
                      <SelectItem value="true">Только с файлами</SelectItem>
                      <SelectItem value="false">Только без файлов</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Теги */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Теги
                  </Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {filters.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => handleTagRemove(tag)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Добавить тег (Enter для добавления)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleTagAdd(e.currentTarget.value)
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                </div>

                <Separator />

                {/* Сортировка */}
                <div className="space-y-2">
                  <Label>Сортировка</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value: any) => handleFilterChange('sortBy', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Дата добавления</SelectItem>
                        <SelectItem value="title">Название</SelectItem>
                        <SelectItem value="author">Автор</SelectItem>
                        <SelectItem value="rating">Рейтинг</SelectItem>
                        <SelectItem value="downloads_count">Скачивания</SelectItem>
                        <SelectItem value="views_count">Просмотры</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.sortOrder}
                      onValueChange={(value: any) => handleFilterChange('sortOrder', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">По убыванию</SelectItem>
                        <SelectItem value="asc">По возрастанию</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Поиск...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Найти
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    <X className="h-4 w-4 mr-2" />
                    Сбросить
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
        )}
      </CardHeader>
    </Card>
  )
}