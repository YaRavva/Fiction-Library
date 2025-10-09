'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Database, BookOpen, Users, AlertCircle, CheckCircle, Clock, Library, LogOut, Settings, Shield, User, BarChart, TrendingUp, File, AlertTriangle, Play, RotateCw, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'


import { TelegramStatsSection } from '@/components/admin/telegram-stats'
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
  
  // Добавляем новые состояния для управления "Книжным Червем"
  const [bookWormRunning, setBookWormRunning] = useState(false)
  const [bookWormMode, setBookWormMode] = useState<'full' | 'update' | 'settings' | null>(null)
  const [bookWormInterval, setBookWormInterval] = useState(30)
  const [bookWormAutoUpdate, setBookWormAutoUpdate] = useState(false)
  const [bookWormStatus, setBookWormStatus] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error';
    message: string;
    progress: number;
  }>({
    status: 'idle',
    message: '',
    progress: 0
  });

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
    setLastDownloadFilesReport(null) // Используем для отображения прогресса синхронизации

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Отладочный вывод
      console.log(`🔍 Запуск синхронизации с лимитом: ${syncLimit}`);

      // Запускаем асинхронную синхронизацию метаданных
      const startResponse = await fetch('/api/admin/sync-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ limit: syncLimit }), // Передаем лимит из поля ввода
      })

      const startData = await startResponse.json()

      if (!startResponse.ok) {
        setError(startData.error || 'Ошибка запуска синхронизации метаданных')
        return
      }

      // Получаем ID операции
      const { operationId } = startData

      // Периодически проверяем статус операции
      let isCompleted = false
      let lastProgressReport = ''
      
      // Начальный отчет
      let progressReport = `🚀 Синхронизация метаданных (лимит: ${syncLimit})  taskId: ${operationId}\n\n📥 Получение сообщений для синхронизации...\n`
      setLastDownloadFilesReport(progressReport)
      lastProgressReport = progressReport

      while (!isCompleted) {
        // Ждем 1.5 секунды перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Проверяем статус операции
        const statusResponse = await fetch(`/api/admin/sync-async?operationId=${operationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        // Проверяем, существует ли ответ
        if (!statusResponse) {
          setError('Не удалось получить статус операции')
          isCompleted = true
          break
        }

        const statusData = await statusResponse.json()

        if (!statusResponse.ok) {
          setError(statusData.error || 'Ошибка получения статуса операции')
          isCompleted = true
          break
        }

        // Формируем отчет с прогрессом
        let currentProgressReport = `🚀 Синхронизация метаданных (лимит: ${syncLimit})  taskId: ${operationId}\n\n`
        
        // Разбираем сообщение на строки для правильного отображения
        const messageLines = statusData.message ? statusData.message.split('\n') : []
        if (messageLines.length > 0) {
          // Обрабатываем строки с обработанными сообщениями
          let inHistorySection = false
          for (let i = 0; i < messageLines.length; i++) {
            const line = messageLines[i]
            if (line.includes('✅') || line.includes('❌') || line.includes('⚠️') || line.includes('🔄')) {
              // Это строка с обработанным сообщением
              currentProgressReport += `${line}\n`
              inHistorySection = true
            } else if (inHistorySection && line.trim() === '') {
              // Пропускаем пустую строку после истории
              continue
            } else if (inHistorySection && (line.includes('📊 Прогресс:') || line.includes('🏁 Завершено:'))) {
              // Это строка с прогрессом или финальным сообщением
              currentProgressReport += `\n${line}\n`
              inHistorySection = false
            } else if (!inHistorySection && line.trim() !== '') {
              // Это другая строка (например, текущее сообщение)
              currentProgressReport += `${line}\n`
            }
          }
        } else {
          currentProgressReport += `${statusData.message || ''}\n`
        }
        
        // Добавляем статус и прогресс
        if (!statusData.message?.includes('📊 Прогресс:') && !statusData.message?.includes('🏁 Завершено:')) {
          currentProgressReport += `\n📊 Статус: ${statusData.status}  📈 Прогресс: ${statusData.progress}%\n`
        }
        
        // Обновляем отчет только если он изменился
        if (currentProgressReport !== lastProgressReport) {
          setLastDownloadFilesReport(currentProgressReport)
          lastProgressReport = currentProgressReport
        }

        // Проверяем, завершена ли операция
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          isCompleted = true
          
          if (statusData.status === 'completed') {
            setLastSyncBooksResult({
              success: statusData.result?.addedCount || 0,
              failed: statusData.result?.errorCount || 0,
              errors: [],
              actions: []
            })
            
            // Финальный отчет в формате, аналогичном загрузке файлов
            let finalReport = `🚀 Результаты синхронизации метаданных\n\n`
            
            // Извлекаем статистику из результата
            const addedCount = statusData.result?.addedCount || 0;
            const updatedCount = statusData.result?.updatedCount || 0;
            const skippedCount = statusData.result?.skippedCount || 0;
            const errorCount = statusData.result?.errorCount || 0;
            const totalCount = statusData.result?.totalCount || 0;
            
            // Формируем статистику
            finalReport += `📊 Статистика:\n`;
            finalReport += `  ✅ Добавлено: ${addedCount}\n`;
            finalReport += `  🔄 Обновлено: ${updatedCount}\n`;
            finalReport += `  ⚠️  Пропущено: ${skippedCount}\n`;
            finalReport += `  ❌ Ошибки: ${errorCount}\n`;
            finalReport += `  📚 Всего: ${totalCount}\n\n`;
            
            // Добавляем историю обработанных сообщений из сообщения статуса
            const messageLines = statusData.message ? statusData.message.split('\n') : [];
            // Ищем строки с историей (все строки до строки с "🏁 Завершено:")
            let historyLines = [];
            for (const line of messageLines) {
              if (line.startsWith('🏁 Завершено:')) {
                break;
              }
              if (line.includes('✅') || line.includes('❌') || line.includes('⚠️') || line.includes('🔄')) {
                historyLines.push(line);
              }
            }
            
            if (historyLines.length > 0) {
              finalReport += historyLines.join('\n') + '\n';
            }
            
            setLastDownloadFilesReport(finalReport)
          } else {
            setError(statusData.message || 'Операция завершена с ошибкой')
            
            // Отчет об ошибке
            let errorReport = `🚀 Синхронизация метаданных (лимит: ${syncLimit})  taskId: ${operationId}\n\n`
            errorReport += `❌ Статус: ${statusData.status}\n`
            errorReport += `💬 Ошибка: ${statusData.message}\n`
            setLastDownloadFilesReport(errorReport)
          }
        }
      }
      
      await loadSyncStatus()
      await loadSyncProgress()
      // Обновляем статистику после синхронизации
      // @ts-ignore
      if (typeof window.refreshSyncStats === 'function') {
        // @ts-ignore
        window.refreshSyncStats()
      }
    } catch (error: unknown) {
      console.error('Sync books error:', error)
      setError('Ошибка при выполнении синхронизации книг')
      
      // Отчет об ошибке
      let errorReport = `🚀 Синхронизация метаданных (лимит: ${syncLimit})\n`
      errorReport += `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}\n`
      setLastDownloadFilesReport(errorReport)
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

      // Запускаем асинхронную загрузку файлов
      const startResponse = await fetch('/api/admin/download-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ limit: syncLimit }), // Передаем лимит из поля ввода
      })

      const startData = await startResponse.json()

      if (!startResponse.ok) {
        setError(startData.error || 'Ошибка запуска загрузки файлов')
        return
      }

      // Получаем ID операции
      const { operationId } = startData

      // Периодически проверяем статус операции
      let isCompleted = false
      let lastProgressReport = ''
      
      // Начальный отчет
      let progressReport = `🚀 Загрузка файлов (лимит: ${syncLimit})  taskId: ${operationId}\n\n📥 Получение списка файлов для загрузки...\n`
      setLastDownloadFilesReport(progressReport)
      lastProgressReport = progressReport

      while (!isCompleted) {
        // Ждем 1.5 секунды перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Проверяем статус операции
        const statusResponse = await fetch(`/api/admin/download-files?operationId=${operationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        // Проверяем, существует ли ответ
        if (!statusResponse) {
          setError('Не удалось получить статус операции')
          isCompleted = true
          break
        }

        const statusData = await statusResponse.json()

        if (!statusResponse.ok) {
          // Если операция не найдена, продолжаем polling
          if (statusResponse.status === 404 && statusData.error === 'Operation not found') {
            // Просто продолжаем polling, задача может еще не быть зарегистрирована
            continue
          }
          
          setError(statusData.error || 'Ошибка получения статуса операции')
          isCompleted = true
          break
        }

        // Формируем отчет с прогрессом
        let currentProgressReport = `🚀 Загрузка файлов (лимит: ${syncLimit})  taskId: ${operationId}\n\n`
        
        // Разбираем сообщение на строки для правильного отображения
        const messageLines = statusData.message ? statusData.message.split('\n') : []
        if (messageLines.length > 0) {
          // Обрабатываем строки с обработанными файлами
          let inHistorySection = false
          for (let i = 0; i < messageLines.length; i++) {
            const line = messageLines[i]
            if (line.includes('✅') || line.includes('❌') || line.includes('⚠️')) {
              // Это строка с обработанным файлом
              currentProgressReport += `${line}\n`
              inHistorySection = true
            } else if (inHistorySection && line.trim() === '') {
              // Пропускаем пустую строку после истории
              continue
            } else if (inHistorySection && (line.includes('📊 Прогресс:') || line.includes('🏁 Завершено:'))) {
              // Это строка с прогрессом или финальным сообщением
              currentProgressReport += `\n${line}\n`
              inHistorySection = false
            } else if (!inHistorySection && line.trim() !== '') {
              // Это другая строка (например, текущий файл)
              currentProgressReport += `${line}\n`
            }
          }
        } else {
          currentProgressReport += `${statusData.message || ''}\n`
        }
        
        // Добавляем статус и прогресс
        if (!statusData.message?.includes('📊 Прогресс:') && !statusData.message?.includes('🏁 Завершено:')) {
          currentProgressReport += `\n📊 Статус: ${statusData.status}  📈 Прогресс: ${statusData.progress}%\n`
        }
        
        // Обновляем отчет только если он изменился
        if (currentProgressReport !== lastProgressReport) {
          setLastDownloadFilesReport(currentProgressReport)
          lastProgressReport = currentProgressReport
        }

        // Проверяем, завершена ли операция
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          isCompleted = true
          
          if (statusData.status === 'completed') {
            setLastDownloadFilesResult(statusData.results)
            
            // Финальный отчет
            let finalReport = `🚀 Загрузка файлов завершена (лимит: ${syncLimit})  taskId: ${operationId}\n\n`
            
            if (statusData.report) {
              // Используем предоставленный отчет
              finalReport += statusData.report
            } else if (statusData.result && statusData.result.results) {
              // Формируем финальный отчет из результата
              finalReport += `📊 Статистика:\n`
              finalReport += `  ✅ Успешно: ${statusData.result.successCount || 0}\n`
              finalReport += `  ❌ Ошибки: ${statusData.result.failedCount || 0}\n`
              finalReport += `  ⚠️  Пропущено: ${statusData.result.skippedCount || 0}\n`
              finalReport += `  📚 Всего: ${statusData.result.totalFiles || statusData.result.results.length}\n\n`
              
              // Добавляем историю обработанных файлов
              const messageLines = statusData.message ? statusData.message.split('\n') : []
              for (const line of messageLines) {
                if (line.includes('✅') || line.includes('❌') || line.includes('⚠️')) {
                  finalReport += `${line}\n`
                }
              }
            }
            
            setLastDownloadFilesReport(finalReport)
          } else {
            setError(statusData.message || 'Операция завершена с ошибкой')
            
            // Отчет об ошибке
            let errorReport = `🚀 Загрузка файлов (лимит: ${syncLimit})  taskId: ${operationId}\n\n`
            errorReport += `❌ Статус: ${statusData.status}\n`
            errorReport += `💬 Ошибка: ${statusData.message}\n`
            setLastDownloadFilesReport(errorReport)
          }
        }
      }
      
      await loadSyncStatus()
      
      // Обновляем статистику после загрузки файлов
      // @ts-ignore
      if (typeof window.refreshSyncStats === 'function') {
        // @ts-ignore
        window.refreshSyncStats()
      }
    } catch (error: unknown) {
      console.error('Ошибка загрузки файлов:', error)
      setError('Ошибка при выполнении загрузки файлов')
      
      // Отчет об ошибке
      let errorReport = `🚀 Загрузка файлов (лимит: ${syncLimit})\n`
      errorReport += `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}\n`
      setLastDownloadFilesReport(errorReport)
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

  // Функция для переключения автоматического обновления
  const handleToggleAutoUpdate = () => {
    setBookWormAutoUpdate(!bookWormAutoUpdate);
  };

  // Функция для запуска "Книжного Червя"
  const handleRunBookWorm = async (mode: 'full' | 'update') => {
    setBookWormRunning(true)
    setBookWormMode(mode)
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Создаем отчет о запуске
      const report = `🐋 Запуск Книжного Червя в режиме ${mode === 'full' ? 'ПОЛНОЙ СИНХРОНИЗАЦИИ' : 'ОБНОВЛЕНИЯ'}...\n\n`
      setLastDownloadFilesReport(report)

      // Вызываем API endpoint для запуска "Книжного Червя"
      const response = await fetch('/api/admin/book-worm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode }),
      })

      const data = await response.json()

      if (response.ok) {
        const finalReport = `${report}✅ Книжный Червь успешно запущен в режиме ${mode}!\n📊 Статус: ${data.message}\n🆔 Process ID: ${data.pid || 'N/A'}`
        setLastDownloadFilesReport(finalReport)
        
        // Обновляем статус
        setBookWormStatus({
          status: 'running',
          message: `Запущен в режиме ${mode}`,
          progress: 0
        });
      } else {
        throw new Error(data.error || 'Ошибка запуска Книжного Червя')
      }
    } catch (error) {
      console.error('Book Worm error:', error)
      setError(`Ошибка при выполнении Книжного Червя: ${(error as Error).message}`)
      const errorReport = `🐋 Запуск Книжного Червя в режиме ${mode === 'full' ? 'ПОЛНОЙ СИНХРОНИЗАЦИИ' : 'ОБНОВЛЕНИЯ'}...\n\n❌ Ошибка: ${(error as Error).message}`
      setLastDownloadFilesReport(errorReport)
      
      // Обновляем статус
      setBookWormStatus({
        status: 'error',
        message: `Ошибка: ${(error as Error).message}`,
        progress: 0
      });
    } finally {
      setBookWormRunning(false)
      setBookWormMode(null)
    }
  }

  // Функция для проверки статуса "Книжного Червя"
  const checkBookWormStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return
      }

      const response = await fetch('/api/admin/book-worm/status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })

      const data = await response.json()

      if (response.ok) {
        setBookWormStatus({
          status: data.status,
          message: data.message,
          progress: data.progress
        });
      }
    } catch (error) {
      console.error('Error checking Book Worm status:', error)
    }
  }

  // Периодически проверяем статус "Книжного Червя"
  useEffect(() => {
    const interval = setInterval(() => {
      if (bookWormRunning || bookWormStatus.status === 'running') {
        checkBookWormStatus()
      }
    }, 5000) // Проверяем каждые 5 секунд

    return () => clearInterval(interval)
  }, [bookWormRunning, bookWormStatus.status])

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

        {/* Unified Sync Books and Download Files - модифицируем этот блок */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Синхронизация</CardTitle>
            <CardDescription>
              Управление синхронизацией данных
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Левая половина - текущий функционал */}
              <div className="space-y-4">
                {/* Поля ввода для синхронизации */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sync-limit">Лимит</Label>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={handleSyncBooks}
                    disabled={syncBooks}
                    className="w-full flex items-center gap-2 h-9 text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncBooks ? 'animate-spin' : ''}`} />
                    {syncBooks ? 'Синхронизация книг...' : 'Загрузить книги'}
                  </Button>
                  <Button
                    onClick={handleDownloadFiles}
                    disabled={downloadFiles}
                    className="w-full flex items-center gap-2 h-9 text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 ${downloadFiles ? 'animate-spin' : ''}`} />
                    {downloadFiles ? 'Загрузка файлов...' : 'Загрузить файлы'}
                  </Button>
                </div>
              </div>

              {/* Правая половина - управление "Книжным Червем" */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Книжный червь</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => handleRunBookWorm('full')}
                      disabled={bookWormRunning && bookWormMode === 'full'}
                      className="w-full flex items-center gap-2 h-9 text-sm"
                    >
                      <Play className="h-4 w-4" />
                      {bookWormRunning && bookWormMode === 'full' ? 'Полная синхронизация...' : 'Полная синхронизация'}
                    </Button>
                    
                    <Button
                      onClick={() => handleRunBookWorm('update')}
                      disabled={bookWormRunning && bookWormMode === 'update'}
                      className="w-full flex items-center gap-2 h-9 text-sm"
                    >
                      <RotateCw className="h-4 w-4" />
                      {bookWormRunning && bookWormMode === 'update' ? 'Обновление...' : 'Обновление'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="book-worm-interval" className="whitespace-nowrap">Интервал (минуты)</Label>
                    <Input
                      id="book-worm-interval"
                      type="number"
                      min="5"
                      max="1440"
                      value={bookWormInterval}
                      onChange={(e) => setBookWormInterval(Math.max(5, Math.min(1440, parseInt(e.target.value) || 30)))}
                      className="w-24 h-8 text-sm"
                    />
                    <Button
                      onClick={handleToggleAutoUpdate}
                      variant={bookWormAutoUpdate ? "default" : "outline"}
                      className="flex-1 h-8 text-sm"
                    >
                      {bookWormAutoUpdate ? 'Включено' : 'Выключено'}
                    </Button>
                  </div>
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

        {/* Удаляем блок TimerSettings */}
        
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
