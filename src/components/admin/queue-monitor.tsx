'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getBrowserSupabase } from '@/lib/browserSupabase'
import { RefreshCw, Play, Square, Activity } from 'lucide-react'

interface QueueStats {
  pending?: number
  processing?: number
  completed?: number
  failed?: number
}

interface QueueTask {
  id: string
  message_id: string
  channel_id: string
  status: string
  error_message?: string | null
  retry_count: number
  priority: number
  scheduled_for: string
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export function QueueMonitor() {
  const [supabase] = useState(() => getBrowserSupabase())
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<QueueStats>({})
  const [tasks, setTasks] = useState<QueueTask[]>([])
  const [workerStatus, setWorkerStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown')
  const [error, setError] = useState<string | null>(null)

  const loadQueueStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Не авторизован')
        return
      }

      const response = await fetch('/api/admin/queue', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || {})
        setTasks(data.activeTasks || [])
      } else {
        setError('Ошибка загрузки статуса очереди')
      }
    } catch (err) {
      console.error('Ошибка статуса очереди:', err)
      setError('Ошибка при загрузке статуса очереди')
    } finally {
      setLoading(false)
    }
  }

  const controlWorker = async (action: 'start' | 'stop' | 'status') => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Не авторизован')
        return
      }

      const response = await fetch('/api/admin/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        const data = await response.json()
        if (action === 'start') {
          setWorkerStatus('running')
        } else if (action === 'stop') {
          setWorkerStatus('stopped')
        } else if (action === 'status') {
          setWorkerStatus(data.running ? 'running' : 'stopped')
        }
        
        // Обновляем статус очереди
        await loadQueueStatus()
      } else {
        setError('Ошибка управления воркером')
      }
    } catch (err) {
      console.error('Ошибка управления воркером:', err)
      setError('Ошибка при управлении воркером')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueueStatus()
    
    // Периодически обновляем статус
    const interval = setInterval(() => {
      loadQueueStatus()
    }, 30000) // Обновляем каждые 30 секунд
    
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'processing': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Ожидает'
      case 'processing': return 'Обрабатывается'
      case 'completed': return 'Завершено'
      case 'failed': return 'Ошибка'
      default: return status
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Очередь загрузки
        </CardTitle>
        <CardDescription>
          Мониторинг задач загрузки файлов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-50 rounded">
              {error}
            </div>
          )}

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
              <div className="text-sm text-muted-foreground">Ожидает</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{stats.processing || 0}</div>
              <div className="text-sm text-muted-foreground">Обрабатывается</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{stats.completed || 0}</div>
              <div className="text-sm text-muted-foreground">Завершено</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{stats.failed || 0}</div>
              <div className="text-sm text-muted-foreground">Ошибка</div>
            </div>
          </div>

          {/* Управление воркером */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => controlWorker('start')}
              disabled={loading || workerStatus === 'running'}
              variant="default"
              size="sm"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Запустить воркер
            </Button>
            <Button
              onClick={() => controlWorker('stop')}
              disabled={loading || workerStatus === 'stopped'}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Остановить воркер
            </Button>
            <Button
              onClick={loadQueueStatus}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>

          {/* Статус воркера */}
          <div className="text-sm">
            Статус воркера: 
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              workerStatus === 'running' ? 'bg-green-100 text-green-800' :
              workerStatus === 'stopped' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {workerStatus === 'running' ? 'Запущен' :
               workerStatus === 'stopped' ? 'Остановлен' :
               'Неизвестно'}
            </span>
          </div>

          {/* Активные задачи */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Активные задачи ({tasks.length})</h4>
              <div className="max-h-60 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">ID</th>
                      <th className="p-2 text-left">Сообщение</th>
                      <th className="p-2 text-left">Статус</th>
                      <th className="p-2 text-left">Создан</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{task.id.slice(0, 8)}</td>
                        <td className="p-2 font-mono text-xs">{task.message_id}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            getStatusColor(task.status)
                          } text-white`}>
                            {getStatusText(task.status)}
                          </span>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {new Date(task.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}