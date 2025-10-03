'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { Toast } from '@/components/ui/toast'

interface TimerSettingsData {
  enabled: boolean
  intervalMinutes: number
}

interface ProcessSettings {
  deduplication: TimerSettingsData
  channelSync: TimerSettingsData
}

export function TimerSettings() {
  const [settings, setSettings] = useState<ProcessSettings>({
    deduplication: {
      enabled: false,
      intervalMinutes: 60,
    },
    channelSync: {
      enabled: false,
      intervalMinutes: 30,
    },
  })
  const [status, setStatus] = useState({
    lastRun: null as string | null,
    nextRun: null as string | null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    // Загружаем настройки
    const loadSettings = async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('No active session');
        }

        const response = await fetch('/api/admin/timer-settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          setSettings({
            deduplication: {
              enabled: data.deduplication?.enabled || false,
              intervalMinutes: data.deduplication?.intervalMinutes || 60,
            },
            channelSync: {
              enabled: data.channelSync?.enabled || false,
              intervalMinutes: data.channelSync?.intervalMinutes || 30,
            },
          })
          setStatus({
            lastRun: data.lastRun,
            nextRun: data.nextScheduledRun,
          })
        }
      } catch (error) {
        console.error('Error loading timer settings:', error)
        setToastMessage("Не удалось загрузить настройки таймера")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const requestBody = {
        deduplication: settings.deduplication,
        channelSync: settings.channelSync,
      };

      const response = await fetch('/api/admin/timer-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      })
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save settings: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Обновляем статус
      const statusResponse = await fetch('/api/admin/timer-settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (statusResponse.ok) {
        const data = await statusResponse.json()
        setStatus({
          lastRun: data.lastRun,
          nextRun: data.nextScheduledRun,
        })
      }
      
      setToastMessage("Настройки таймера успешно сохранены")
    } catch (error: any) {
      console.error('Error saving timer settings:', error)
      setToastMessage(`Не удалось сохранить настройки: ${error.message || error}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleProcess = (process: keyof ProcessSettings) => {
    setSettings(prev => ({
      ...prev,
      [process]: {
        ...prev[process],
        enabled: !prev[process].enabled
      }
    }))
  }

  if (loading) {
    return <div>Загрузка настроек...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки таймеров</CardTitle>
        <CardDescription>
          Настройте автоматические процессы для регулярного выполнения
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Deduplication Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Автоматическая дедупликация</h3>
                <p className="text-sm text-muted-foreground">
                  Регулярная проверка и удаление дубликатов книг
                </p>
              </div>
              <Button 
                variant={settings.deduplication.enabled ? "default" : "outline"}
                onClick={() => toggleProcess('deduplication')}
              >
                {settings.deduplication.enabled ? "Включено" : "Выключено"}
              </Button>
            </div>
            
            {settings.deduplication.enabled && (
              <div className="space-y-2 pl-2 border-l-2 border-muted">
                <Label htmlFor="deduplication-interval">Интервал (в минутах)</Label>
                <Input
                  id="deduplication-interval"
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.deduplication.intervalMinutes}
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      deduplication: {
                        ...prev.deduplication,
                        intervalMinutes: Math.max(5, Math.min(1440, parseInt(e.target.value) || 60))
                      }
                    }))
                  }
                  className="max-w-[200px]"
                />
                <p className="text-sm text-muted-foreground">
                  Минимум 5 минут, максимум 1440 минут (24 часа)
                </p>
              </div>
            )}
          </div>
          
          {/* Channel Sync Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Синхронизация каналов</h3>
                <p className="text-sm text-muted-foreground">
                  Проверка каналов на наличие новых публикаций
                </p>
              </div>
              <Button 
                variant={settings.channelSync.enabled ? "default" : "outline"}
                onClick={() => toggleProcess('channelSync')}
              >
                {settings.channelSync.enabled ? "Включено" : "Выключено"}
              </Button>
            </div>
            
            {settings.channelSync.enabled && (
              <div className="space-y-2 pl-2 border-l-2 border-muted">
                <Label htmlFor="channel-sync-interval">Интервал (в минутах)</Label>
                <Input
                  id="channel-sync-interval"
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.channelSync.intervalMinutes}
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      channelSync: {
                        ...prev.channelSync,
                        intervalMinutes: Math.max(5, Math.min(1440, parseInt(e.target.value) || 30))
                      }
                    }))
                  }
                  className="max-w-[200px]"
                />
                <p className="text-sm text-muted-foreground">
                  Минимум 5 минут, максимум 1440 минут (24 часа)
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-sm">
              <span className="font-medium">Последний запуск:</span>{' '}
              {status.lastRun ? new Date(status.lastRun).toLocaleString('ru-RU') : 'Никогда'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Следующий запуск:</span>{' '}
              {status.nextRun ? new Date(status.nextRun).toLocaleString('ru-RU') : 'Не запланирован'}
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </div>
      </CardContent>
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </Card>
  )
}