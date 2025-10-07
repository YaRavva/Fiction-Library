'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { BookOpen, Database, AlertCircle, CheckCircle, File, TrendingUp, Clock } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/browserSupabase'

interface TelegramStats {
  booksInDatabase: number
  booksInTelegram: number
  missingBooks: number
  booksWithoutFiles: number
}

interface SyncProgress {
  totalBooks: number
  processedBooks: number
  unprocessedBooks: number
  processedMessages: number
  completionPercentage: number
  recentUnprocessed: {
    id: string
    title: string
    author: string
    created_at: string
  }[]
}

export function TelegramStatsSection() {
  const [stats, setStats] = useState<TelegramStats | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadLimit, setDownloadLimit] = useState(10)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      setError(null)
      
      console.log('Fetching Telegram stats...');
      // Получаем сессию для авторизации
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Increase timeout to 30 seconds for Telegram operations
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('Timeout triggered after 30 seconds');
        controller.abort();
      }, 30000); // 30 second timeout
      
      const response = await fetch('/api/admin/telegram-stats', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Error data:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Stats data:', data);
      setStats(data)
    } catch (err: unknown) {
      console.log('Error caught in loadStats:', err);
      console.log('Error name:', (err as Error).name);
      console.log('Error message:', (err as Error).message);
      
      if ((err as Error).name === 'AbortError') {
        console.error('Timeout loading Telegram stats after 30 seconds');
        setError('Таймаут запроса: операция заняла слишком много времени (более 30 секунд)')
      } else {
        console.error('Error loading Telegram stats:', err)
        setError(`Ошибка загрузки статистики Telegram: ${(err as Error).message || 'Неизвестная ошибка'}`)
      }
    }
  }

  const loadSyncProgress = async () => {
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Add timeout to the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch('/api/admin/sync-progress', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setSyncProgress(data.stats || null)
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error loading sync progress:', err)
      }
    }
  }

  const loadQueueStats = async () => {
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin/queue', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // We don't need to set queue stats anymore since we removed the QueueMonitor component
      }
    } catch (err: unknown) {
      console.error('Error loading queue stats:', err)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      await loadStats()
      await loadSyncProgress()
    }
    
    initialize()
    
    // Отключаем автоматическое обновление статистики
    // const interval = setInterval(() => {
    //   if (!downloading) {
    //     loadStats()
    //   }
    // }, 30000)
    
    // return () => clearInterval(interval)
  }, [])

  const handleDownloadMissing = async () => {
    try {
      setDownloading(true)
      setProgress(0)
      setLogs(['Начало загрузки отсутствующих книг...'])
      setError(null)
      
      console.log('Starting download of missing books with limit:', downloadLimit);
      // Получаем сессию для авторизации
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin/telegram-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ limit: downloadLimit }),
      })
      
      console.log('Download response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Download error data:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Download response data:', data);
      setProgress(data.progress || 100)
      
      // Обновляем логи
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs)
      } else {
        setLogs(prev => [...prev, `Загрузка завершена. Обработано файлов: ${data.files?.length || 0}`])
      }
      
      // Обновляем статистику после загрузки
      await loadStats()
      await loadSyncProgress()
    } catch (err: unknown) {
      console.error('Error downloading missing books:', err)
      setError(`Ошибка при загрузке отсутствующих книг: ${(err as Error).message || 'Неизвестная ошибка'}`)
      setLogs(prev => [...prev, `Ошибка при загрузке отсутствующих книг: ${(err as Error).message || 'Неизвестная ошибка'}`])
    } finally {
      setDownloading(false)
    }
  }

  // Remove the loading state check that was showing "Загрузка статистики..."
  // The component will always render the cards and just update the numbers

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Статистика</CardTitle>
        <CardDescription>
          Информация о книгах в Telegram канале и в базе данных
        </CardDescription>
      </CardHeader>
      <div className="absolute top-4 right-4">
        <Button 
          onClick={async () => {
            await loadStats()
            await loadSyncProgress()
          }}
          disabled={downloading} // Disable only during download, not during stats refresh
          variant="outline"
          size="sm"
        >
          Обновить
        </Button>
      </div>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="break-words">{error}</div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="font-medium">Книг в Telegram</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats?.booksInTelegram || 0}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-green-500 mr-2" />
              <h3 className="font-medium">В базе данных</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats?.booksInDatabase || 0}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <h3 className="font-medium">Отсутствуют книги</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats?.missingBooks || 0}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <File className="h-5 w-5 text-red-500 mr-2" />
              <h3 className="font-medium">Отсутствуют файлы</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats?.booksWithoutFiles || 0}
            </p>
          </div>
        </div>
        
        {/* Блок "Загрузка отсутствующих книг" удален по требованию */}
      </CardContent>
    </Card>
  )
}