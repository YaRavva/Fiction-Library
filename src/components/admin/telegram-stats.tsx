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

    // Делаем функцию для установки отчета доступной глобально
    // @ts-ignore
    window.setStatsUpdateReport = (report: string) => {
      // Эта функция будет переопределена админ-панелью
      console.log('Stats update report:', report);
    };

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

      // @ts-ignore
      if (typeof window.setStatsUpdateReport === 'function') {
        // @ts-ignore
        delete window.setStatsUpdateReport;
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

      // Показываем начальный прогресс в результатах
      const progressReport = `🔄 Обновление статистики Telegram

📊 СТАТУС: Запуск операции обновления статистики...

⏳ Подготовка к подсчету книг в Telegram канале...
⏳ Подготовка к подсчету книг в базе данных...
⏳ Подготовка к подсчету книг без файлов...

⏱️ Операция может занять несколько минут...
`;

      // Отправляем прогресс в админ-панель через глобальную функцию
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        (window as any).setStatsUpdateReport(progressReport);
      }

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

      // Показываем прогресс обновления
      const updateProgressReport = `🔄 Обновление статистики Telegram

📊 СТАТУС: Операция запущена успешно!

✅ Сервер получил запрос на обновление
⏳ Выполняется подсчет книг в Telegram канале...
⏳ Выполняется подсчет книг в базе данных...
⏳ Выполняется подсчет книг без файлов...

⏱️ Ожидание завершения операции...
⏱️ Данные обновятся автоматически через несколько минут...
`;

      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        (window as any).setStatsUpdateReport(updateProgressReport);
      }

      // Не показываем локальное сообщение - вся информация в результатах

      // Проверяем обновление данных каждые 5 секунд в течение 2 минут
      let attempts = 0;
      const maxAttempts = 24; // 2 минуты (24 * 5 секунд)

      const checkForUpdates = async () => {
        attempts++;

        try {
          const freshStats = await loadStats();

          // Если данные изменились или прошло много времени, считаем обновление завершенным
          if (attempts >= maxAttempts) {
            const finalReport = `✅ Обновление статистики завершено!

📊 Финальные результаты:
📚 Книг в Telegram: ${stats.booksInTelegram}
💾 В базе данных: ${stats.booksInDatabase}
❌ Отсутствуют книги: ${stats.missingBooks}
📁 Отсутствуют файлы: ${stats.booksWithoutFiles}

⏱️ Операция выполнена за ${Math.round(attempts * 5 / 60)} минут
`;

            if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
              (window as any).setStatsUpdateReport(finalReport);
            }

            // Обновляем данные в карточках после завершения операции
            await loadStats();
            setUpdating(false); // Разблокируем кнопку только после полного завершения
            return;
          }

          // Продолжаем проверку через 5 секунд
          setTimeout(checkForUpdates, 5000);

        } catch (error) {
          console.error('Error checking for updates:', error);
          attempts = maxAttempts; // Прекращаем попытки при ошибке
        }
      };

      // Начинаем проверку обновлений через 10 секунд
      setTimeout(checkForUpdates, 10000);

    } catch (err: unknown) {
      console.error('Error updating Telegram stats:', err)
      setUpdating(false) // Разблокируем кнопку при ошибке

      // Обновляем данные в карточках даже при ошибке, чтобы показать актуальную информацию
      await loadStats();

      setError(`Ошибка при обновлении статистики Telegram: ${(err as Error).message || 'Неизвестная ошибка'}`)

      // Показываем ошибку в результатах
      const errorReport = `❌ Ошибка обновления статистики Telegram

💬 Описание ошибки: ${(err as Error).message || 'Неизвестная ошибка'}

🔄 Попробуйте повторить операцию позже
`;

      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        (window as any).setStatsUpdateReport(errorReport);
      }
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
        {/* Локальные сообщения убраны - вся информация в результатах операции */}
        
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