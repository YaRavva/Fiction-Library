'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, BookOpen, Database, File, RefreshCw, CheckCircle, Loader2 } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/browserSupabase'

interface TelegramStats {
  booksInDatabase: number
  booksInTelegram: number
  missingBooks: number
  booksWithoutFiles: number
}

interface PreviousStats {
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
  const [previousStats, setPreviousStats] = useState<PreviousStats>({
    booksInDatabase: 0,
    booksInTelegram: 0,
    missingBooks: 0,
    booksWithoutFiles: 0
  })
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [animatedStats, setAnimatedStats] = useState<TelegramStats>({
    booksInDatabase: 0,
    booksInTelegram: 0,
    missingBooks: 0,
    booksWithoutFiles: 0
  })
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  // Функция для анимации цифр
  const animateNumbers = (from: TelegramStats, to: TelegramStats) => {
    const duration = 1000 // 1 секунда
    const steps = 60 // 60 кадров в секунду
    const stepDuration = duration / steps
    const stepValue = {
      booksInDatabase: (to.booksInDatabase - from.booksInDatabase) / steps,
      booksInTelegram: (to.booksInTelegram - from.booksInTelegram) / steps,
      missingBooks: (to.missingBooks - from.missingBooks) / steps,
      booksWithoutFiles: (to.booksWithoutFiles - from.booksWithoutFiles) / steps,
    }

    let currentStep = 0

    const animate = () => {
      currentStep++
      setAnimatedStats({
        booksInDatabase: Math.round(from.booksInDatabase + stepValue.booksInDatabase * currentStep),
        booksInTelegram: Math.round(from.booksInTelegram + stepValue.booksInTelegram * currentStep),
        missingBooks: Math.round(from.missingBooks + stepValue.missingBooks * currentStep),
        booksWithoutFiles: Math.round(from.booksWithoutFiles + stepValue.booksWithoutFiles * currentStep),
      })

      if (currentStep < steps) {
        animationRef.current = setTimeout(animate, stepDuration)
      } else {
        setAnimatedStats(to)
      }
    }

    animate()
  }

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

      const newStats = {
        booksInDatabase: data.booksInDatabase || 0,
        booksInTelegram: data.booksInTelegram || 0,
        missingBooks: data.missingBooks || 0,
        booksWithoutFiles: data.booksWithoutFiles || 0
      }

      // Анимируем изменение цифр только если это не первая загрузка
      if (stats.booksInDatabase !== 0 || stats.booksInTelegram !== 0) {
        setPreviousStats(stats)
        animateNumbers(stats, newStats)
      } else {
        setAnimatedStats(newStats)
      }

      setStats(newStats)
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
      // Очищаем анимацию
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }

      // @ts-ignore
      if (typeof window.refreshSyncStats === 'function') {
        // @ts-ignore
        delete window.refreshSyncStats;
      }
    };
  }, []);

  // Очищаем анимацию при обновлении состояния успеха/ошибки
  useEffect(() => {
    if (success || error) {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [success, error])

  const updateStats = async () => {
    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

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
      setSuccess('✅ Обновление статистики запущено. Данные обновятся автоматически...')

      // Статистика обновится асинхронно, поэтому перезагружаем данные через некоторое время
      setTimeout(() => {
        loadStats()
        setSuccess(null)
      }, 2000) // Уменьшил до 2 секунд для лучшего UX

    } catch (err: unknown) {
      console.error('Error updating Telegram stats:', err)
      setError(`Ошибка при обновлении статистики Telegram: ${(err as Error).message || 'Неизвестная ошибка'}`)
      setSuccess(null)
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
          className="min-w-[100px]"
        >
          {updating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Обновление...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </>
          )}
        </Button>
      </div>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="break-words">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md flex items-center border border-green-200">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="break-words">{success}</div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="font-medium">Книг в Telegram</h3>
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
              {animatedStats.booksInTelegram.toLocaleString()}
            </p>
            {previousStats.booksInTelegram !== 0 && previousStats.booksInTelegram !== stats.booksInTelegram && (
              <div className="text-xs text-muted-foreground mt-1">
                Было: {previousStats.booksInTelegram.toLocaleString()}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-green-500 mr-2" />
              <h3 className="font-medium">В базе данных</h3>
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
              {animatedStats.booksInDatabase.toLocaleString()}
            </p>
            {previousStats.booksInDatabase !== 0 && previousStats.booksInDatabase !== stats.booksInDatabase && (
              <div className="text-xs text-muted-foreground mt-1">
                Было: {previousStats.booksInDatabase.toLocaleString()}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <h3 className="font-medium">Отсутствуют книги</h3>
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
              {animatedStats.missingBooks.toLocaleString()}
            </p>
            {previousStats.missingBooks !== 0 && previousStats.missingBooks !== stats.missingBooks && (
              <div className="text-xs text-muted-foreground mt-1">
                Было: {previousStats.missingBooks.toLocaleString()}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <File className="h-5 w-5 text-red-500 mr-2" />
              <h3 className="font-medium">Отсутствуют файлы</h3>
            </div>
            <p className="text-2xl font-bold mt-2 tabular-nums transition-all duration-300">
              {animatedStats.booksWithoutFiles.toLocaleString()}
            </p>
            {previousStats.booksWithoutFiles !== 0 && previousStats.booksWithoutFiles !== stats.booksWithoutFiles && (
              <div className="text-xs text-muted-foreground mt-1">
                Было: {previousStats.booksWithoutFiles.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}