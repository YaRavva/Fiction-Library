'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Database, BookOpen, Users, AlertCircle, CheckCircle, Clock, Library, LogOut, Settings, Shield, User, BarChart, TrendingUp, File, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DownloadQueueMonitor } from '@/components/telegram/download-queue'
import { TimerSettings } from '@/components/admin/timer-settings'
import { TelegramStatsSection } from '@/components/admin/telegram-stats'
import { SyncStatsSection } from '@/components/admin/sync-stats'
import { getValidSession } from '@/lib/auth-helpers'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface SyncStatus {
  id: string
  channel_id: string
  last_message_id: string
  last_sync_at: string
  error_count: number
  is_active: boolean
}

interface SyncStats {
  totalBooks: number
  totalSeries: number
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

interface SyncResult {
  success: number
  failed: number
  errors: string[]
  actions?: string[]
}

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

// Add User interface
interface User {
  id: string
  email?: string
  // Add other properties as needed
}

export default function AdminPage() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncBooks, setSyncBooks] = useState(false)
  const [downloadFiles, setDownloadFiles] = useState(false)
  const [checkingProgress, setCheckingProgress] = useState(false)
  const [syncLimit, setSyncLimit] = useState(100) // Изменено на 100 по умолчанию
  const [syncHistory, setSyncHistory] = useState<SyncStatus[]>([])
  const [stats, setStats] = useState<SyncStats>({ totalBooks: 0, totalSeries: 0 })
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [lastSyncBooksResult, setLastSyncBooksResult] = useState<SyncResult | null>(null)
  const [lastDownloadFilesResult, setLastDownloadFilesResult] = useState<SyncResult | null>(null)
  const [lastDownloadFilesReport, setLastDownloadFilesReport] = useState<string | null>(null) // Добавляем состояние для отчета
  const [error, setError] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [user, setUser] = useState<User | null>(null) // Fix: Replace any with User | null

  const loadSyncStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Add timeout to the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch('/api/admin/sync', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setSyncHistory(data.syncHistory || [])
        setStats(data.stats || { totalBooks: 0, totalSeries: 0 })
      } else if (response.status === 403) {
        setError('У вас нет прав доступа к админ панели')
      }
    } catch (error: unknown) { // Fix: Replace any with unknown
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error loading sync status:', error)
        setError('Ошибка загрузки статуса синхронизации')
      }
    }
  }, [supabase, router])

  const loadSyncProgress = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      // Add timeout to the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch('/api/admin/sync-progress', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setSyncProgress(data.stats || null)
      }
    } catch (error: unknown) { // Fix: Replace any with unknown
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error loading sync progress:', error)
      }
    }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Проверяем и обновляем сессию
        const session = await getValidSession(supabase)

        // Если сессии нет - перенаправляем на логин
        if (!session) {
          console.log('No valid session, redirecting to login...')
          router.push('/auth/login')
          return
        }

        setUser(session.user)

        // Проверяем роль пользователя
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('Error loading profile:', profileError)
          router.push('/auth/login')
          return
        }

        if (profile?.role !== 'admin') {
          console.log('User is not admin, redirecting...')
          router.push('/access-denied')
          return
        }

        setUserProfile(profile)
        await loadSyncStatus()
        await loadSyncProgress()
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [supabase, router, loadSyncStatus, loadSyncProgress])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setLastSyncResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          limit: syncLimit,
          channelType: 'metadata',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setLastSyncResult(data.results)
        await loadSyncStatus()
        await loadSyncProgress()
      } else {
        setError(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      console.error('Sync error:', error)
      setError('Ошибка при выполнении синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncBooks = async () => {
    setSyncBooks(true)
    setError(null)
    setLastSyncBooksResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Отладочный вывод
      console.log(`🔍 Запуск синхронизации с лимитом: ${syncLimit}`);

      // Увеличиваем таймаут до 5 минут
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 минут timeout

      const response = await fetch('/api/admin/sync-books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          limit: syncLimit // Используем значение из поля ввода
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()
      
      // Отладочный вывод результата
      console.log('📊 Результат синхронизации:', data);

      if (response.ok) {
        setLastSyncBooksResult({
          success: data.results?.processed || 0,
          failed: data.results?.errors || 0,
          errors: [],
          actions: data.actions || []
        })
        await loadSyncStatus()
        await loadSyncProgress()
        // Обновляем статистику после синхронизации
        // @ts-ignore
        if (typeof window.refreshSyncStats === 'function') {
          // @ts-ignore
          window.refreshSyncStats()
        }
      } else {
        setError(data.error || 'Ошибка синхронизации книг')
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Таймаут запроса: операция заняла слишком много времени. Синхронизация продолжается в фоновом режиме.')
      } else {
        console.error('Sync books error:', error)
        setError('Ошибка при выполнении синхронизации книг')
      }
    } finally {
      setSyncBooks(false)
    }
  }

  const handleDownloadFiles = async () => {
    setDownloadFiles(true)
    setError(null)
    setLastDownloadFilesResult(null)
    setLastDownloadFilesReport(null) // Очищаем предыдущий отчет

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Add timeout to the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      // Используем новый endpoint и передаем лимит
      const response = await fetch('/api/admin/download-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ limit: syncLimit }), // Передаем лимит из поля ввода
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (response.ok) {
        setLastDownloadFilesResult(data.results)
        setLastDownloadFilesReport(data.report || null) // Сохраняем отчет
        await loadSyncStatus()
        
        // Обновляем статистику после загрузки файлов
        // @ts-ignore
        if (typeof window.refreshSyncStats === 'function') {
          // @ts-ignore
          window.refreshSyncStats()
        }
      } else {
        setError(data.error || 'Ошибка загрузки файлов')
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Таймаут запроса: операция заняла слишком много времени')
      } else {
        console.error('Download files error:', error)
        setError('Ошибка при выполнении загрузки файлов')
      }
    } finally {
      setDownloadFiles(false)
    }
  }

  const handleCheckProgress = async () => {
    setCheckingProgress(true)
    try {
      await loadSyncProgress()
    } catch (error) {
      console.error('Check progress error:', error)
      setError('Ошибка при проверке прогресса')
    } finally {
      setCheckingProgress(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Library className="h-12 w-12 mx-auto animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Загрузка админ панели...</p>
        </div>
      </div>
    )
  }

  if (error && !syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="mr-2" />
              Ошибка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/library')}>
              Вернуться в библиотеку
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center">
            <a href="/library" className="mr-6 flex items-center space-x-2">
              <Library className="h-6 w-6" />
              <span className="hidden font-bold sm:inline-block">
                Fiction Library
              </span>
            </a>
          </div>
          <div className="hidden md:block text-center absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-lg font-bold">Админ панель</h1>
            <p className="text-xs text-muted-foreground">
              Управление синхронизацией с Telegram
            </p>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Search would go here if needed */}
            </div>

            <nav className="flex items-center gap-2">
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
                  <DropdownMenuItem onClick={() => router.push('/library')}>
                    <Library className="mr-2 h-4 w-4" />
                    <span>Библиотека</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
        {/* Заголовок перемещен в навбар */}
        <div className="mb-6">
          {/* <h1 className="text-3xl font-bold">Админ панель</h1>
          <p className="text-muted-foreground">
            Управление синхронизацией с Telegram
          </p> */}
        </div>
        
        {/* Telegram Stats - перемещен в самый верх */}
        <div className="mb-6">
          <TelegramStatsSection />
        </div>

        {/* Sync Stats */}
        <div className="mb-6">
          <SyncStatsSection />
        </div>

        {/* Unified Sync Books and Download Files */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Синхронизация</CardTitle>
            <CardDescription>
              Синхронизировать книги и загрузить файлы
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Поля ввода для синхронизации */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-limit">Лимит публикаций</Label>
                  <Input
                    id="sync-limit"
                    type="number"
                    min="1"
                    max="1000"
                    value={syncLimit}
                    onChange={(e) => setSyncLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 100)))}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Количество публикаций для синхронизации (1-1000)
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Button
                    onClick={handleSyncBooks}
                    disabled={syncBooks}
                    className="w-full flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncBooks ? 'animate-spin' : ''}`} />
                    {syncBooks ? 'Синхронизация книг...' : 'Синхронизировать книги'}
                  </Button>
                </div>
                <div className="flex-1">
                  <Button
                    onClick={handleDownloadFiles}
                    disabled={downloadFiles}
                    className="w-full flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${downloadFiles ? 'animate-spin' : ''}`} />
                    {downloadFiles ? 'Загрузка файлов...' : 'Загрузить файлы'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Результаты последней операции с расширенной информацией */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Результаты последней операции</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-2 bg-muted">
              <textarea
                value={
                  lastDownloadFilesReport ? 
                  lastDownloadFilesReport : // Показываем отчет, если он есть
                  lastDownloadFilesResult ? 
                  `Загрузка файлов:\n` +
                  `Успешно: ${lastDownloadFilesResult.success}\n` +
                  `Ошибок: ${lastDownloadFilesResult.failed}` +
                  (lastDownloadFilesResult.errors.length > 0 ? 
                    `\n\nДетали ошибок:\n` + 
                    lastDownloadFilesResult.errors.join('\n') : 
                    '') +
                  (lastDownloadFilesResult.actions && lastDownloadFilesResult.actions.length > 0 ?
                    `\n\nВыполненные действия:\n` +
                    lastDownloadFilesResult.actions.map((action, index) => `${index + 1}. ${action}`).join('\n') :
                    '') : 
                  lastSyncBooksResult ? 
                  `Синхронизация книг:\n` +
                  `Успешно: ${lastSyncBooksResult.success}\n` +
                  `Ошибок: ${lastSyncBooksResult.failed}` +
                  (lastSyncBooksResult.errors.length > 0 ? 
                    `\n\nДетали ошибок:\n` + 
                    lastSyncBooksResult.errors.join('\n') : 
                    '') +
                  (lastSyncBooksResult.actions && lastSyncBooksResult.actions.length > 0 ?
                    `\n\nВыполненные действия:\n` +
                    lastSyncBooksResult.actions.map((action, index) => `${index + 1}. ${action}`).join('\n') :
                    '') : 
                  lastSyncResult ? 
                  `Обычная синхронизация:\n` +
                  `Успешно: ${lastSyncResult.success}\n` +
                  `Ошибок: ${lastSyncResult.failed}` +
                  (lastSyncResult.errors.length > 0 ? 
                    `\n\nДетали ошибок:\n` + 
                    lastSyncResult.errors.join('\n') : 
                    '') : 
                  'Нет данных'}
                readOnly
                className="w-full h-96 font-mono text-xs overflow-y-auto max-h-96 p-2 bg-background border rounded"
                placeholder="Результаты последней операции..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Timer Settings */}
        <div className="mb-6">
          <TimerSettings />
        </div>
        
        {/* Back to Library */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push('/library')}>
            Вернуться в библиотеку
          </Button>
        </div>
      </div>
    </div>
  )
}
