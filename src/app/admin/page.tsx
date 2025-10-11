'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Library, LogOut, Settings, Play, RefreshCw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

import { TelegramStatsSection } from '@/components/admin/telegram-stats';
import { FileSearchManager } from '@/components/admin/file-search-manager';
import { getValidSession } from '@/lib/auth-helpers';


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
  // Состояния только для Книжного червя
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
  const [lastBookWormReport, setLastBookWormReport] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [interactiveSearchState, setInteractiveSearchState] = useState<{
    status: 'idle' | 'loading' | 'searching' | 'processing' | 'completed' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: ''
  });

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
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Регистрируем глобальные функции для логирования в окно результатов
    if (typeof window !== 'undefined') {
      // Функция для Книжного червя
      (window as any).setStatsUpdateReport = (report: string) => {
        setLastBookWormReport(prev => {
          const newReport = prev ? prev + report : report;
          return newReport;
        });
      };

      // Функция для поиска файлов
      (window as any).updateFileSearchResults = (report: string) => {
        setLastBookWormReport(prev => {
          const newReport = prev ? prev + report : report;
          return newReport;
        });
      };
    }

    // Инициализируем окно результатов пустым сообщением
    setLastBookWormReport('');

    // Очищаем функции при размонтировании компонента
    return () => {
      if (typeof window !== 'undefined') {
        if ((window as any).setStatsUpdateReport) {
          delete (window as any).setStatsUpdateReport;
        }
        if ((window as any).updateFileSearchResults) {
          delete (window as any).updateFileSearchResults;
        }
      }
    };
  }, [supabase, router])




  // Функция для переключения автоматического обновления
  const handleToggleAutoUpdate = () => {
    setBookWormAutoUpdate(!bookWormAutoUpdate);
  };

  // Функции для интерактивного поиска файлов
  const handleStartInteractiveSearch = () => {
    // Здесь будет логика запуска интерактивного поиска
    console.log('Начать интерактивный поиск');
  };

  const handleResetInteractiveSearch = () => {
    // Здесь будет логика сброса интерактивного поиска
    console.log('Сброс интерактивного поиска');
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
      setLastBookWormReport(report)

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
        // Если это режим обновления, отображаем подробный отчет
        if (mode === 'update' && data.result) {
          // Используем подробный отчет из API, если он есть
          const detailedReport = data.report || 
            `🐋 Результаты работы Книжного Червя в режиме ОБНОВЛЕНИЯ:\n` +
            `=====================================================\n\n` +
            `📚 Метаданные:\n` +
            `   ✅ Обработано: ${data.result.metadata.processed}\n` +
            `   ➕ Добавлено: ${data.result.metadata.added}\n` +
            `   🔄 Обновлено: ${data.result.metadata.updated}\n` +
            `   ⚠️  Пропущено: ${data.result.metadata.skipped}\n` +
            `   ❌ Ошибок: ${data.result.metadata.errors}\n\n` +
            `📁 Файлы:\n` +
            `   ✅ Обработано: ${data.result.files.processed}\n` +
            `   🔗 Привязано: ${data.result.files.linked}\n` +
            `   ⚠️  Пропущено: ${data.result.files.skipped}\n` +
            `   ❌ Ошибок: ${data.result.files.errors}\n\n` +
            `📊 Сводка:\n` +
            `   Всего обработано элементов: ${data.result.metadata.processed + data.result.files.processed}\n` +
            `   Успешных операций: ${data.result.metadata.added + data.result.metadata.updated + data.result.files.linked}\n` +
            `   Ошибок: ${data.result.metadata.errors + data.result.files.errors}`;
          
          setLastBookWormReport(detailedReport);
        } else {
          // Для полной синхронизации или других случаев
          const finalReport = `${report}✅ Книжный Червь успешно запущен в режиме ${mode}!\n📊 Статус: ${data.message}\n🆔 Process ID: ${data.pid || 'N/A'}`
          setLastBookWormReport(finalReport)
        }
        
        // Обновляем статус
        setBookWormStatus({
          status: 'completed',
          message: `Завершен в режиме ${mode}`,
          progress: 100
        });
      } else {
        throw new Error(data.error || 'Ошибка запуска Книжного Червя')
      }
    } catch (error) {
      console.error('Book Worm error:', error)
      setError(`Ошибка при выполнении Книжного Червя: ${(error as Error).message}`)
      const errorReport = `🐋 Запуск Книжного Червя в режиме ${mode === 'full' ? 'ПОЛНОЙ СИНХРОНИЗАЦИИ' : 'ОБНОВЛЕНИЯ'}...\n\n❌ Ошибка: ${(error as Error).message}`
      setLastBookWormReport(errorReport)
      
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
  }, [bookWormRunning, bookWormStatus.status, checkBookWormStatus]) // Добавлен checkBookWormStatus в зависимости

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

  if (error) {
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
        {/* Telegram Stats - перемещен в самый верх */}
        <div className="mb-6">
          <TelegramStatsSection />
        </div>

        {/* Книжный червь - минималистичный дизайн */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Книжный червь</CardTitle>
            <CardDescription>
              Управление синхронизацией
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-6">
              {/* Управление Книжным червем */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleRunBookWorm('full')}
                  disabled={bookWormRunning && bookWormMode === 'full'}
                  size="sm"
                >
                  Полная
                </Button>

                <Button
                  onClick={() => handleRunBookWorm('update')}
                  disabled={bookWormRunning && bookWormMode === 'update'}
                  variant="outline"
                  size="sm"
                >
                  Обновление
                </Button>
                
                {/* Интерактивный поиск файлов */}
                <FileSearchManager />
              </div>

              {/* Настройки таймера */}
              <div className="flex items-center gap-2">
                <Label htmlFor="book-worm-interval" className="text-sm whitespace-nowrap">
                  Таймер:
                </Label>
                <Input
                  id="book-worm-interval"
                  type="number"
                  min="5"
                  max="1440"
                  value={bookWormInterval}
                  onChange={(e) => setBookWormInterval(Math.max(5, Math.min(1440, parseInt(e.target.value) || 30)))}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-sm text-muted-foreground">мин</span>
                <Button
                  onClick={handleToggleAutoUpdate}
                  variant={bookWormAutoUpdate ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                >
                  {bookWormAutoUpdate ? 'ВКЛ' : 'ВЫКЛ'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Результаты последней операции с расширенной информацией */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Результаты</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-2 bg-muted">
              <textarea
                id="results-textarea"
                value={
                  lastBookWormReport && lastBookWormReport.trim() ?
                  lastBookWormReport : // Показываем отчет Книжного червя или поиска файлов
                  ''}
                readOnly
                className="w-full h-[1000px] font-mono text-xs overflow-y-auto max-h-[1000px] p-2 bg-background border rounded"
                placeholder="Результаты последней операции..."
              />
            </div>
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
