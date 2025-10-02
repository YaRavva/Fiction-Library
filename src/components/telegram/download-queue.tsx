import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { DownloadQueue, DownloadTask } from '@/lib/telegram/queue'

export function DownloadQueueMonitor() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [stats, setStats] = useState({ pending: 0 })
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Загрузки</h3>
        <span className="text-sm text-muted-foreground">
          В очереди: {stats.pending}
        </span>
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