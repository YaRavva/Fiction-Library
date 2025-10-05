'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getBrowserSupabase } from '@/lib/browserSupabase'

interface SyncStatsData {
  telegramTotal: number
  databaseTotal: number
  missingBooks: number
  missingFiles: number
  processedBooks: number
  remainingBooks: number
}

export function SyncStatsSection() {
  const [supabase] = useState(() => getBrowserSupabase())
  const [stats, setStats] = useState<SyncStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshRef = useRef<(() => void) | null>(null)

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Получаем статистику из API
      const response = await fetch('/api/admin/sync-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      } else {
        throw new Error('Failed to load stats')
      }
    } catch (err) {
      console.error('Error loading stats:', err)
      setError('Ошибка загрузки статистики')
    } finally {
      setLoading(false)
    }
  }

  // Создаем функцию для обновления статистики
  const refreshStats = async () => {
    await loadStats()
  }

  // Сохраняем ссылку на функцию обновления
  useEffect(() => {
    refreshRef.current = refreshStats
  }, [])

  useEffect(() => {
    loadStats()
  }, [])

  // Делаем функцию обновления доступной глобально для использования из других компонентов
  useEffect(() => {
    // @ts-ignore
    window.refreshSyncStats = refreshStats
    return () => {
      // @ts-ignore
      delete window.refreshSyncStats
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
          <CardDescription>Загрузка данных...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
          <CardDescription>Ошибка загрузки</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
          <CardDescription>Нет данных</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Нет данных для отображения</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статистика</CardTitle>
        <CardDescription>
          Информация о книгах в Telegram канале и в базе данных
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">В Telegram</h3>
              <p className="text-2xl font-bold">{stats.telegramTotal}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">В базе данных</h3>
              <p className="text-2xl font-bold">{stats.databaseTotal}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Отсутствуют книги</h3>
              <p className="text-2xl font-bold text-orange-600">{stats.missingBooks}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Отсутствуют файлы</h3>
              <p className="text-2xl font-bold text-red-600">{stats.missingFiles}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Обработано книг</h3>
              <p className="text-2xl font-bold text-green-600">{stats.processedBooks}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Осталось обработать</h3>
              <p className="text-2xl font-bold">{stats.remainingBooks}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Экспортируем функцию обновления статистики отдельно
export { type SyncStatsData }