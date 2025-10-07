'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, BookOpen, Database, File, RefreshCw } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/browserSupabase'

interface TelegramStats {
  booksInDatabase: number
  booksInTelegram: number
  missingBooks: number
  booksWithoutFiles: number
}

export function TelegramStatsSection() {
  const [stats, setStats] = useState<TelegramStats>({
    booksInDatabase: 0,
    booksInTelegram: 0,
    missingBooks: 0,
    booksWithoutFiles: 0
  })
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      setError(null)
      
      console.log('Fetching Telegram stats...');
      // Получаем сессию для авторизации
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin/telegram-stats', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      })
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Error data:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Stats data:', data);
      setStats({
        booksInDatabase: data.booksInDatabase || 0,
        booksInTelegram: data.booksInTelegram || 0,
        missingBooks: data.missingBooks || 0,
        booksWithoutFiles: data.booksWithoutFiles || 0
      })
    } catch (err: unknown) {
      console.log('Error caught in loadStats:', err);
      console.log('Error name:', (err as Error).name);
      console.log('Error message:', (err as Error).message);
      
      console.error('Error loading Telegram stats:', err)
      setError(`Ошибка загрузки статистики Telegram: ${(err as Error).message || 'Неизвестная ошибка'}`)
    }
  }

  // Загружаем начальные данные и делаем функцию доступной глобально
  useEffect(() => {
    loadStats();
    
    // @ts-ignore
    window.refreshSyncStats = loadStats;
    
    // Очищаем при размонтировании
    return () => {
      // @ts-ignore
      if (typeof window.refreshSyncStats === 'function') {
        // @ts-ignore
        delete window.refreshSyncStats;
      }
    };
  }, []);

  const updateStats = async () => {
    try {
      setUpdating(true)
      setError(null)
      
      console.log('Starting stats update...');
      // Получаем сессию для авторизации
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin/telegram-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      })
      
      console.log('Update response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Update error data:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Update response data:', data);
      
      // Показываем сообщение об успешном запуске обновления
      // Статистика обновится асинхронно, поэтому перезагружаем данные через некоторое время
      setTimeout(() => {
        loadStats()
      }, 3000) // Перезагружаем через 3 секунды
      
    } catch (err: unknown) {
      console.error('Error updating Telegram stats:', err)
      setError(`Ошибка при обновлении статистики Telegram: ${(err as Error).message || 'Неизвестная ошибка'}`)
    } finally {
      setUpdating(false)
    }
  }

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
          onClick={updateStats}
          disabled={updating}
          variant="outline"
          size="sm"
        >
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </>
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
              {stats.booksInTelegram}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-green-500 mr-2" />
              <h3 className="font-medium">В базе данных</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats.booksInDatabase}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <h3 className="font-medium">Отсутствуют книги</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats.missingBooks}
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="flex items-center">
              <File className="h-5 w-5 text-red-500 mr-2" />
              <h3 className="font-medium">Отсутствуют файлы</h3>
            </div>
            <p className="text-2xl font-bold mt-2">
              {stats.booksWithoutFiles}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}