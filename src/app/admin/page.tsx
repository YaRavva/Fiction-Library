'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Database, BookOpen, Users, AlertCircle, CheckCircle, Clock, Library, LogOut, Settings, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DownloadQueueMonitor } from '@/components/telegram/download-queue'
import { TimerSettings } from '@/components/admin/timer-settings'
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

interface SyncResult {
  success: number
  failed: number
  errors: string[]
}

interface UserProfile {
  id: string
  username?: string
  display_name?: string
  role: string
}

export default function AdminPage() {
  const [supabase] = useState(() => getBrowserSupabase())
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncLimit, setSyncLimit] = useState(10)
  const [syncHistory, setSyncHistory] = useState<SyncStatus[]>([])
  const [stats, setStats] = useState<SyncStats>({ totalBooks: 0, totalSeries: 0 })
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [user, setUser] = useState<any>(null)

  const loadSyncStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/admin/sync', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSyncHistory(data.syncHistory || [])
        setStats(data.stats || { totalBooks: 0, totalSeries: 0 })
      } else if (response.status === 403) {
        setError('У вас нет прав доступа к админ панели')
      }
    } catch (error) {
      console.error('Error loading sync status:', error)
      setError('Ошибка загрузки статуса синхронизации')
    }
  }, [supabase, router])

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
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [supabase, router, loadSyncStatus])

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
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/library" className="mr-6 flex items-center space-x-2">
              <Library className="h-6 w-6" />
              <span className="hidden font-bold sm:inline-block">
                Fiction Library
              </span>
            </a>
          </div>

          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Админ панель</h1>
          <p className="text-muted-foreground">
            Управление синхронизацией с Telegram
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего книг</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBooks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего серий</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSeries}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Последняя синхронизация</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {syncHistory.length > 0
                  ? new Date(syncHistory[0].last_sync_at).toLocaleString('ru-RU')
                  : 'Никогда'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Control */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Синхронизация метаданных</CardTitle>
            <CardDescription>
              Загрузить метаданные книг из Telegram канала
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="syncLimit">Количество сообщений</Label>
                  <Input
                    id="syncLimit"
                    type="number"
                    min="1"
                    max="100"
                    value={syncLimit}
                    onChange={(e) => setSyncLimit(parseInt(e.target.value) || 10)}
                    disabled={syncing}
                  />
                </div>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Синхронизация...' : 'Запустить синхронизацию'}
                </Button>
              </div>

              {lastSyncResult && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Результаты последней синхронизации:</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Успешно: {lastSyncResult.success}
                    </div>
                    {lastSyncResult.failed > 0 && (
                      <div className="flex items-center text-destructive">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Ошибок: {lastSyncResult.failed}
                      </div>
                    )}
                    {lastSyncResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Детали ошибок:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {lastSyncResult.errors.map((error, index) => (
                            <li key={index} className="truncate">• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Download Queue Monitor */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Очередь загрузок</CardTitle>
            <CardDescription>
              Мониторинг загрузки файлов из Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DownloadQueueMonitor />
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