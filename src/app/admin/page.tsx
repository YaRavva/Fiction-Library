'use client'

import { getBrowserSupabase } from '@/lib/browserSupabase'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { SyncSettingsShadix } from '@/components/admin/sync-settings-shadix';
import { getValidSession } from '@/lib/auth-helpers';
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { PageTransition } from '@/components/ui/page-transition'
import { Checkbox } from '@/components/ui/checkbox'

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
  const [bookWormMode, setBookWormMode] = useState<'full' | 'update' | null>(null)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Эффект для автоматической прокрутки текстового поля результатов
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [lastBookWormReport]);

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
    console.log('🔍 Initializing lastBookWormReport with empty string');
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
  const handleToggleAutoUpdate = (checked: boolean) => {
    setBookWormAutoUpdate(checked);
  };

  // Функция для проверки необходимости автообновления (клиентская реализация как резервный вариант)
  const checkAutoUpdate = async () => {
    if (!bookWormAutoUpdate) return; // Не проверяем, если автообновление отключено
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/book-worm/auto-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Auto update check completed:', data);
      } else {
        console.error('Auto update check failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error checking auto update:', error);
    }
  };

  // Устанавливаем интервал для проверки автообновления (резервный вариант, если GitHub Actions не настроен)
  useEffect(() => {
    if (bookWormAutoUpdate) {
      // Проверяем автообновление каждые 30 минут как резервный вариант (GitHub Actions обычно используется для основного автообновления)
      const interval = setInterval(checkAutoUpdate, Math.max(30, bookWormInterval) * 60 * 1000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [bookWormAutoUpdate, bookWormInterval]);

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
      const report = `🔄 Запуск синхронизации в режиме ${mode === 'full' ? 'ПОЛНОЙ СИНХРОНИЗАЦИИ' : 'ОБНОВЛЕНИЯ'}...\n\n`
      setLastBookWormReport(report)

      // Для полной синхронизации используем новый dedicated endpoint
      const endpoint = mode === 'full' ? '/api/admin/book-worm/full-sync' : '/api/admin/book-worm';
      
      // Вызываем API endpoint для запуска синхронизации
      const response = await fetch(endpoint, {
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
          // Используем отформатированное сообщение из API, если оно есть
          const detailedReport = data.formattedMessage || 
            (data.report || 
            `🔄 Результаты работы синхронизации в режиме ОБНОВЛЕНИЯ:\n` +
            `=====================================================\n\n` +
            `📚 Метаданные:\n` +
            `   ✅ Обработано: ${data.result.metadata?.processed || 0}\n` +
            `   ➕ Добавлено: ${data.result.metadata?.added || 0}\n` +
            `   🔄 Обновлено: ${data.result.metadata?.updated || 0}\n` +
            `   ⚠️  Пропущено: ${data.result.metadata?.skipped || 0}\n` +
            `   ❌ Ошибок: ${data.result.metadata?.errors || 0}\n\n` +
            `📁 Файлы:\n` +
            `   ✅ Обработано: ${data.result.files?.processed || 0}\n` +
            `   🔗 Привязано: ${data.result.files?.linked || 0}\n` +
            `   ⚠️  Пропущено: ${data.result.files?.skipped || 0}\n` +
            `   ❌ Ошибок: ${data.result.files?.errors || 0}\n\n` +
            `📊 Сводка:\n` +
            `   Всего обработано элементов: ${(data.result.metadata?.processed || 0) + (data.result.files?.processed || 0)}\n` +
            `   Успешных операций: ${(data.result.metadata?.added || 0) + (data.result.metadata?.updated || 0) + (data.result.files?.linked || 0)}\n` +
            `   Ошибок: ${(data.result.metadata?.errors || 0) + (data.result.files?.errors || 0)}`);
          
          setLastBookWormReport(detailedReport);
        } else {
          // Для полной синхронизации или других случаев
          const finalReport = data.formattedMessage || 
            `${report}✅ Синхронизация успешно запущена в режиме ${mode}!\n📊 Статус: ${data.message}\n🆔 Process ID: ${data.pid || 'N/A'}`
          setLastBookWormReport(finalReport)
        }
        
        // Обновляем статус
        setBookWormStatus({
          status: 'completed',
          message: `Завершена в режиме ${mode}`,
          progress: 100
        });
      } else {
        throw new Error(data.error || 'Ошибка запуска синхронизации')
      }
    } catch (error) {
      console.error('Sync error:', error)
      setError(`Ошибка при выполнении синхронизации: ${(error as Error).message}`)
      // Обновляем отчет об ошибке
      const errorReport = `🔄 Запуск синхронизации в режиме ${mode === 'full' ? 'ПОЛНОЙ СИНХРОНИЗАЦИИ' : 'ОБНОВЛЕНИЯ'}...\n\n❌ Ошибка: ${(error as Error).message}`
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

  // Функция для проверки статуса синхронизации
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
      console.error('Error checking sync status:', error)
    }
  }

  // Периодически проверяем статус синхронизации
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
    <PageTransition>
      <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 items-center justify-between">
          <div className="flex items-center">
            <a href="/library" className="mr-6 flex items-center space-x-2">
              <Library className="h-6 w-6" />
              <span className="hidden font-bold sm:inline-block">
                Fiction Library
              </span>
            </a>
          </div>
          <div className="hidden md:block text-center absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-base font-bold">Админ панель</h1>
          </div>

          <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Search would go here if needed */}
            </div>

            <nav className="flex items-center gap-2">
              <ThemeToggle />
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

        {/* Синхронизация */}
        <div className="mb-6">
          <SyncSettingsShadix
            bookWormRunning={bookWormRunning}
            bookWormMode={bookWormMode}
            bookWormInterval={bookWormInterval}
            bookWormAutoUpdate={bookWormAutoUpdate}
            handleRunBookWorm={handleRunBookWorm}
            handleToggleAutoUpdate={handleToggleAutoUpdate}
            setBookWormInterval={setBookWormInterval}
          />
        </div>

        {/* Результаты последней операции с расширенной информацией */}
        <Card className="mb-6">
          <CardHeader className="space-y-0 pb-1">
            <CardTitle className="text-lg font-semibold">Результаты</CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="border rounded-md p-1 bg-muted">
              <textarea
                id="results-textarea"
                value={
                  lastBookWormReport && lastBookWormReport.trim() ?
                  lastBookWormReport : // Показываем отчет Книжного червя или поиска файлов
                  ''}
                readOnly
                className="w-full h-[500px] font-mono text-sm overflow-y-auto max-h-[500px] p-1 bg-background border rounded"
                placeholder="Результаты последней операции..."
                ref={textareaRef}
              />
            </div>
          </CardContent>
        </Card>

        {/* Back to Library */}
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => router.push('/library')} className="h-8 text-sm">
            Вернуться в библиотеку
          </Button>
        </div>
      </div>
      </div>
    </PageTransition>
  )
}