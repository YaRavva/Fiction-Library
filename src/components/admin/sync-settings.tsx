'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { FileSearchManager } from './file-search-manager'
import { getBrowserSupabase } from '@/lib/browserSupabase'

interface SyncSettingsProps {
  bookWormRunning: boolean
  bookWormMode: 'full' | 'update' | null
  bookWormInterval: number
  bookWormAutoUpdate: boolean
  handleRunBookWorm: (mode: 'full' | 'update') => void
  handleToggleAutoUpdate: (checked: boolean) => void
  setBookWormInterval: (interval: number) => void
}

export function SyncSettings({
  bookWormRunning,
  bookWormMode,
  bookWormInterval,
  bookWormAutoUpdate,
  handleRunBookWorm,
  handleToggleAutoUpdate,
  setBookWormInterval
}: SyncSettingsProps) {
  const [supabase] = useState(() => getBrowserSupabase())
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(bookWormAutoUpdate)
  const [timerValue, setTimerValue] = useState(bookWormInterval)
  const [initialLoad, setInitialLoad] = useState(true) // Флаг для определения первоначальной загрузки

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
          // Обновляем родительские состояния
          handleToggleAutoUpdate(settings.enabled)
          setBookWormInterval(settings.interval)
        }
      } else {
        console.error('Failed to load auto update settings:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading auto update settings:', error)
    } finally {
      setInitialLoad(false) // Устанавливаем флаг после загрузки
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
        console.error('Failed to save auto update settings:', response.statusText)
        // Вызываем alert или показываем ошибку пользователю
        alert('Ошибка сохранения настроек автообновления: ' + response.statusText)
      } else {
        console.log('Auto update settings saved successfully')
      }
    } catch (error) {
      console.error('Error saving auto update settings:', error)
      alert('Ошибка соединения при сохранении настроек автообновления')
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

  return (
    <div className="w-full p-6">
      <div className="w-full space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Синхронизация</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 items-start justify-center">
          {/* Синхронизация книг и файлов */}
          <div className="space-y-3 w-full">
            <h2 className="text-base font-medium">Синхронизация книг и файлов</h2>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={() => handleRunBookWorm("full")}
                  disabled={bookWormRunning && bookWormMode === "full"}
                  size="default"
                >
                  {bookWormRunning && bookWormMode === "full" ? "Выполняется..." : "Полная"}
                </Button>

                <Button
                  onClick={() => handleRunBookWorm("update")}
                  disabled={bookWormRunning && bookWormMode === "update"}
                  variant="outline"
                  size="default"
                >
                  {bookWormRunning && bookWormMode === "update" ? "Обновление..." : "Обновление"}
                </Button>
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
        </div>
      </div>
    </div>
  )
}