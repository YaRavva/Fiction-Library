'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import ActionButton from "@/components/ui/action-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { FileSearchManager } from './file-search-manager'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { RefreshCw, Search, Trash2, Database, RotateCcw } from 'lucide-react';

interface SyncSettingsShadixProps {
  bookWormRunning: boolean
  bookWormMode: 'full' | 'update' | null
  bookWormInterval: number
  bookWormAutoUpdate: boolean
  handleRunBookWorm: (mode: 'full' | 'update') => void
  handleToggleAutoUpdate: (checked: boolean) => void
  setBookWormInterval: (interval: number) => void
}

export function SyncSettingsShadix({
  bookWormRunning,
  bookWormMode,
  bookWormInterval,
  bookWormAutoUpdate,
  handleRunBookWorm,
  handleToggleAutoUpdate,
  setBookWormInterval
}: SyncSettingsShadixProps) {
  const [supabase] = useState(() => getBrowserSupabase())
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(bookWormAutoUpdate)
  const [timerValue, setTimerValue] = useState(bookWormInterval)
  const [initialLoad, setInitialLoad] = useState(true)
  const [searching, setSearching] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загружаем настройки автообновления при монтировании компонента
  useEffect(() => {
    loadAutoUpdateSettings()
  }, [])

  // Обновляем состояние при изменениях извне (только после первоначальной загрузки)
  useEffect(() => {
    if (!initialLoad) {
      setAutoUpdateEnabled(bookWormAutoUpdate)
      setTimerValue(bookWormInterval)
    }
  }, [bookWormAutoUpdate, bookWormInterval, initialLoad])

  const loadAutoUpdateSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/book-worm/auto-update', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const { settings } = await response.json()
        if (settings) {
          setAutoUpdateEnabled(settings.enabled)
          setTimerValue(settings.interval)
          handleToggleAutoUpdate(settings.enabled)
          setBookWormInterval(settings.interval)
        }
      } else {
        console.error('Failed to load auto update settings:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading auto update settings:', error)
    } finally {
      setInitialLoad(false)
    }
  }

  const saveAutoUpdateSettings = async (enabled: boolean, interval: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/admin/book-worm/auto-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          enabled: enabled,
          interval: interval
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save auto update settings: ' + response.statusText)
      }
      
      return { message: 'Настройки автообновления сохранены', error: false }
    } catch (error) {
      console.error('Error saving auto update settings:', error)
      return { message: 'Ошибка сохранения настроек: ' + (error as Error).message, error: true }
    }
  }

  const handleAutoUpdateChange = (checked: boolean) => {
    const newChecked = Boolean(checked)
    setAutoUpdateEnabled(newChecked)
    handleToggleAutoUpdate(newChecked)
    
    // Сохраняем изменения в базу данных только при изменении состояния чекбокса
    saveAutoUpdateSettings(newChecked, timerValue)
  }

  const handleTimerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Math.max(5, Math.min(1440, Number.parseInt(e.target.value) || 30))
    setTimerValue(newValue)
    setBookWormInterval(newValue)
    
    // Сохраняем изменения в базу данных ТОЛЬКО если автообновление включено
    if (autoUpdateEnabled) {
      saveAutoUpdateSettings(autoUpdateEnabled, newValue)
    }
  }

  // Action Button handlers
  const handleFullSyncConfirm = async () => {
    try {
      handleRunBookWorm('full')
      return { message: 'Полная синхронизация запущена', error: false }
    } catch (error) {
      return { message: 'Ошибка запуска полной синхронизации', error: true }
    }
  }

  const handleUpdateSyncConfirm = async () => {
    try {
      handleRunBookWorm('update')
      return { message: 'Обновление запущено', error: false }
    } catch (error) {
      return { message: 'Ошибка запуска обновления', error: true }
    }
  }

  const handleSearchDuplicatesConfirm = async () => {
    try {
      setError(null);
      setSearching(true);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Сессия не найдена');
      }

      // Показываем начальный прогресс в результатах
      const timestamp = new Date().toLocaleTimeString('ru-RU');
      const progressReport = `[${timestamp}] 🔍 Начат поиск дубликатов книг...\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(progressReport);
        } catch (error) {
          console.error('❌ Ошибка при отправке сообщения в окно результатов:', error);
        }
      }

      const response = await fetch('/api/admin/duplicates', {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Отправляем результаты в окно результатов
      const resultTimestamp = new Date().toLocaleTimeString('ru-RU');
      let resultReport = `[${resultTimestamp}] ✅ Поиск дубликатов завершен!\n`;
      resultReport += `📊 Найдено ${data.duplicateGroups.length} групп потенциальных дубликатов\n`;
      resultReport += `💡 Потенциальных дубликатов: ${data.stats.potentialDuplicates}\n`;
      resultReport += `📈 Примерное количество уникальных книг: ${data.stats.uniqueBooksEstimate}\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(resultReport);
        } catch (error) {
          console.error('❌ Error sending results to window:', error);
        }
      }

      return { 
        message: `Найдено ${data.duplicateGroups.length} групп дубликатов`, 
        error: false 
      }

    } catch (err) {
      console.error('Error searching duplicates:', err);
      setError(`Ошибка при поиске дубликатов: ${(err as Error).message}`);
      
      // Отправляем ошибку в окно результатов
      const errorTimestamp = new Date().toLocaleTimeString('ru-RU');
      const errorReport = `[${errorTimestamp}] ❌ Ошибка поиска дубликатов: ${(err as Error).message}\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(errorReport);
        } catch (error) {
          console.error('❌ Error sending error to results window:', error);
        }
      }

      return { 
        message: `Ошибка поиска дубликатов: ${(err as Error).message}`, 
        error: true 
      }
    } finally {
      setSearching(false);
    }
  };

  const handleRemoveDuplicatesConfirm = async () => {
    try {
      setError(null);
      setRemoving(true);
      
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        throw new Error('Сессия не найдена');
      }

      // Показываем начальный прогресс в результатах
      const timestamp = new Date().toLocaleTimeString('ru-RU');
      const progressReport = `[${timestamp}] 🗑️ Начато удаление дубликатов книг...\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(progressReport);
        } catch (error) {
          console.error('❌ Ошибка при отправке сообщения в окно результатов:', error);
        }
      }

      const response = await fetch('/api/admin/duplicates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Отправляем результаты в окно результатов
      const resultTimestamp = new Date().toLocaleTimeString('ru-RU');
      let resultReport = `[${resultTimestamp}] ✅ Удаление дубликатов завершено!\n`;
      resultReport += `📊 Удалено: ${data.deletedCount} книг\n`;
      if (data.totalErrors > 0) {
        resultReport += `⚠️ Ошибок: ${data.totalErrors}\n`;
      }
      resultReport += `📋 ${data.message}\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(resultReport);
        } catch (error) {
          console.error('❌ Error sending results to window:', error);
        }
      }

      return { 
        message: `Удалено ${data.deletedCount} дубликатов`, 
        error: false 
      }

    } catch (err) {
      console.error('Error removing duplicates:', err);
      setError(`Ошибка при удалении дубликатов: ${(err as Error).message}`);
      
      // Отправляем ошибку в окно результатов
      const errorTimestamp = new Date().toLocaleTimeString('ru-RU');
      const errorReport = `[${errorTimestamp}] ❌ Ошибка удаления дубликатов: ${(err as Error).message}\n`;
      
      if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
        try {
          (window as any).setStatsUpdateReport(errorReport);
        } catch (error) {
          console.error('❌ Error sending error to results window:', error);
        }
      }

      return { 
        message: `Ошибка удаления дубликатов: ${(err as Error).message}`, 
        error: true 
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="w-full p-6">
      <div className="w-full space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Синхронизация</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 items-start justify-center">
          {/* Синхронизация книг и файлов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Синхронизация книг и файлов</h2>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <ActionButton
                  onClick={handleFullSyncConfirm}
                  disabled={bookWormRunning && bookWormMode === "full"}
                  size="default"
                  title="Полная синхронизация"
                  popupContent={
                    <div>
                      <p>Запустить <strong>полную синхронизацию</strong> библиотеки?</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Это может занять длительное время. Будут обработаны все сообщения из Telegram каналов.
                      </p>
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Что будет выполнено:</p>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          <li>• Синхронизация метаданных книг</li>
                          <li>• Загрузка и привязка файлов</li>
                          <li>• Обновление обложек</li>
                          <li>• Дедупликация записей</li>
                        </ul>
                      </div>
                    </div>
                  }
                  onConfirm={handleFullSyncConfirm}
                >
                  <Database className="h-4 w-4 mr-2" />
                  {bookWormRunning && bookWormMode === "full" ? "Выполняется..." : "Полная"}
                </ActionButton>

                <ActionButton
                  onClick={handleUpdateSyncConfirm}
                  disabled={bookWormRunning && bookWormMode === "update"}
                  variant="outline"
                  size="default"
                  title="Обновление библиотеки"
                  popupContent={
                    <div>
                      <p>Запустить <strong>обновление</strong> библиотеки?</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Будут обработаны только новые сообщения с момента последней синхронизации.
                      </p>
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Что будет выполнено:</p>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          <li>• Проверка новых сообщений</li>
                          <li>• Добавление новых книг</li>
                          <li>• Привязка новых файлов</li>
                        </ul>
                      </div>
                    </div>
                  }
                  onConfirm={handleUpdateSyncConfirm}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {bookWormRunning && bookWormMode === "update" ? "Обновление..." : "Обновление"}
                </ActionButton>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="book-worm-interval" className="text-sm font-medium whitespace-nowrap">
                    Таймер:
                  </Label>
                  <Input
                    id="book-worm-interval"
                    type="number"
                    min="5"
                    max="1440"
                    value={timerValue}
                    onChange={handleTimerChange}
                    className="w-20 h-9 text-sm font-mono"
                  />
                  <span className="text-sm text-muted-foreground font-medium">мин</span>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="auto-update" 
                    checked={autoUpdateEnabled} 
                    onCheckedChange={handleAutoUpdateChange} 
                  />
                  <label
                    htmlFor="auto-update"
                    className="text-sm font-medium leading-none cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Автообновление
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Полуавтоматический поиск файлов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Полуавтоматический поиск файлов</h2>
            <FileSearchManager />
          </div>

          {/* Поиск и удаление дубликатов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Поиск и удаление дубликатов</h2>
            <div className="space-y-3 w-full">
              <div className="flex flex-wrap items-center gap-4">
                <ActionButton
                  onClick={handleSearchDuplicatesConfirm}
                  disabled={searching || removing}
                  size="default"
                  title="Поиск дубликатов"
                  popupContent={
                    <div>
                      <p>Запустить <strong>поиск дубликатов</strong> в библиотеке?</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Система найдет потенциальные дубликаты книг по названию и автору.
                      </p>
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Алгоритм поиска:</p>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          <li>• Нормализация названий</li>
                          <li>• Сравнение авторов</li>
                          <li>• Анализ метаданных</li>
                        </ul>
                      </div>
                    </div>
                  }
                  onConfirm={handleSearchDuplicatesConfirm}
                >
                  {searching ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Поиск...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Поиск дубликатов
                    </>
                  )}
                </ActionButton>
                
                <ActionButton
                  onClick={handleRemoveDuplicatesConfirm}
                  disabled={searching || removing}
                  variant="destructive"
                  size="default"
                  title="Удаление дубликатов"
                  popupContent={
                    <div>
                      <p>Удалить найденные <strong>дубликаты</strong> из библиотеки?</p>
                      <p className="text-sm text-destructive mt-2 font-medium">
                        ⚠️ Это действие нельзя отменить!
                      </p>
                      <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm font-medium text-destructive">Что будет удалено:</p>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          <li>• Дублирующие записи книг</li>
                          <li>• Связанные метаданные</li>
                          <li>• Файлы останутся в хранилище</li>
                        </ul>
                      </div>
                    </div>
                  }
                  onConfirm={handleRemoveDuplicatesConfirm}
                >
                  {removing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Удаление...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить дубликаты
                    </>
                  )}
                </ActionButton>
              </div>

              {error && (
                <div className="text-destructive text-sm p-2 bg-destructive/10 rounded">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}