import { createClient } from '@/lib/supabase';

// Типы для очереди загрузок
export type DownloadTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DownloadTask {
  id: string;
  message_id: string;
  channel_id: string;
  file_id: string | null;
  book_id: string | null;
  status: DownloadTaskStatus;
  error_message?: string | null;
  retry_count: number;
  priority: number;
  scheduled_for: Date;
  started_at?: Date | null;
  completed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDownloadTaskParams {
  message_id: string;
  channel_id: string;
  file_id?: string;
  book_id?: string;
  priority?: number;
}

export class DownloadQueue {
  private _supabase: ReturnType<typeof createClient> | null = null;
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Добавляет новую задачу в очередь загрузок
   */
  async addTask(params: CreateDownloadTaskParams): Promise<DownloadTask | null> {
    const { data, error } = await this.supabase
      .from('telegram_download_queue')
      .insert([{
        message_id: params.message_id,
        channel_id: params.channel_id,
        file_id: params.file_id,
        book_id: params.book_id,
        priority: params.priority || 0,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding download task:', error);
      return null;
    }

    return data as DownloadTask;
  }

  /**
   * Получает следующую задачу на загрузку
   */
  async getNextTask(): Promise<DownloadTask | null> {
    const { data, error } = await this.supabase
      .rpc('get_next_download_task')
      .single();

    if (error) {
      console.error('Error getting next task:', error);
      return null;
    }

    return data as DownloadTask;
  }

  /**
   * Обновляет статус задачи
   */
  async completeTask(taskId: string, success: boolean, errorMsg?: string): Promise<boolean> {
    const { error } = await this.supabase
      .rpc('complete_download_task', {
        task_id: taskId,
        success,
        error_msg: errorMsg,
      });

    if (error) {
      console.error('Error completing task:', error);
      return false;
    }

    return true;
  }

  /**
   * Получает статистику очереди
   */
  async getQueueStats() {
    const { data, error } = await this.supabase
      .from('telegram_download_queue')
      .select('status', { count: 'exact' })
      .eq('status', 'pending');

    if (error) {
      console.error('Error getting queue stats:', error);
      return { pending: 0 };
    }

    return { pending: data.length };
  }

  /**
   * Получает список активных задач
   */
  async getActiveTasks(limit = 10): Promise<DownloadTask[]> {
    const { data, error } = await this.supabase
      .from('telegram_download_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting active tasks:', error);
      return [];
    }

    return data as DownloadTask[];
  }
}