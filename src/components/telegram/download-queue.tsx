import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { DownloadQueue, DownloadTask } from '@/lib/telegram/queue'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'

export function DownloadQueueMonitor() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [stats, setStats] = useState({ pending: 0 })
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const queue = new DownloadQueue()

  useEffect(() => {
    const loadTasks = async () => {
      const [newTasks, newStats] = await Promise.all([
        queue.getActiveTasks(),
        queue.getQueueStats()
      ])
      setTasks(newTasks)
      setStats(newStats)
    }

    loadTasks()
    // Обновляем каждые 5 секунд
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [])

  // Функция для синхронизации файлов из канала "Архив для фантастики"
  const syncArchiveFiles = async () => {
    try {
      const response = await fetch('/api/admin/sync-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 10, addToQueue: true }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Результат синхронизации:', result);
      
      // Обновляем список задач
      const [newTasks, newStats] = await Promise.all([
        queue.getActiveTasks(),
        queue.getQueueStats()
      ])
      setTasks(newTasks)
      setStats(newStats)
      
      setToastMessage(`Успешно обработано файлов: ${result.files.length}`);
    } catch (error) {
      console.error('Ошибка синхронизации файлов архива:', error);
      setToastMessage('Ошибка при синхронизации файлов');
    }
  }

  // Функция для запуска дедупликации
  const runDeduplication = async (mode: 'dry-run' | 'execute' = 'dry-run') => {
    try {
      const response = await fetch('/api/admin/deduplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, limit: 100 }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Результат дедупликации:', result);
      
      if (mode === 'execute') {
        setToastMessage(`Дедупликация завершена:\nНайдено дубликатов: ${result.duplicatesFound}\nУдалено: ${result.duplicatesRemoved}`);
      } else {
        setToastMessage(`Анализ дедупликации завершен:\nНайдено дубликатов: ${result.duplicatesFound}`);
      }
    } catch (error) {
      console.error('Ошибка выполнения дедупликации:', error);
      setToastMessage('Ошибка при выполнении дедупликации');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Загрузки</h3>
        <div className="flex items-center gap-2">
          <Button onClick={syncArchiveFiles} size="sm">
            Синхронизировать файлы
          </Button>
          <span className="text-sm text-muted-foreground">
            В очереди: {stats.pending}
          </span>
        </div>
      </div>
      
      <div className="grid gap-4">
        {tasks.map(task => (
          <Card key={task.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Сообщение {task.message_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  Канал: {task.channel_id}
                </p>
              </div>
              <TaskStatus status={task.status} error={task.error_message} />
            </div>
            
            {task.error_message && (
              <p className="mt-2 text-xs text-destructive">
                {task.error_message}
              </p>
            )}
            
            <div className="mt-2 text-xs text-muted-foreground">
              {task.status === 'processing' ? (
                <>Начато {formatDate(task.started_at)}</>
              ) : (
                <>Запланировано на {formatDate(task.scheduled_for)}</>
              )}
            </div>
          </Card>
        ))}
      </div>
      
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  )
}

function TaskStatus({ status, error }: { status: string; error?: string | null }) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-500'
      case 'processing':
        return 'text-blue-500'
      case 'failed':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Завершено'
      case 'processing':
        return 'В процессе'
      case 'failed':
        return 'Ошибка'
      default:
        return 'Ожидает'
    }
  }

  return (
    <span className={`text-sm font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  )
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return ''
  return new Date(date).toLocaleString('ru', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}