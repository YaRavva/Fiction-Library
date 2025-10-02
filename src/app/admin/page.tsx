'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Database, BookOpen, Users, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DownloadQueueMonitor } from '@/components/telegram/download-queue'
import { getValidSession } from '@/lib/auth-helpers'

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

        // Проверяем роль пользователя
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error && !syncing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertCircle className="mr-2" />
              Ошибка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <Button onClick={() => router.push('/library')}>
              Вернуться в библиотеку
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Админ панель
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Управление синхронизацией с Telegram
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        <Card className="mb-8">
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
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Результаты последней синхронизации:</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Успешно: {lastSyncResult.success}
                    </div>
                    {lastSyncResult.failed > 0 && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Ошибок: {lastSyncResult.failed}
                      </div>
                    )}
                    {lastSyncResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Детали ошибок:</p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
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
        <Card className="mb-8">
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

