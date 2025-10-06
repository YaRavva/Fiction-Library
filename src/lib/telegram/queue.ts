import { getSupabaseAdmin } from '@/lib/supabase';

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
  private _supabase: ReturnType<typeof getSupabaseAdmin> | null = null;
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseAdmin();
    }
    if (!this._supabase) {
      throw new Error('Supabase admin client is not available');
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
      }] as any)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Ошибка добавления задачи загрузки:', error);
      return null;
    }

    return data as DownloadTask | null;
  }

  /**
   * Получает следующую задачу на загрузку
   */
  async getNextTask(): Promise<DownloadTask | null> {
    const { data, error } = await this.supabase
      .rpc('get_next_download_task')
      .maybeSingle();

    if (error) {
      console.error('Ошибка получения следующей задачи:', error);
      return null;
    }

    return data as DownloadTask | null;
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
      } as any);

    if (error) {
      console.error('Ошибка завершения задачи:', error);
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
      .select('status', { count: 'exact' } as any)
      .eq('status', 'pending');

    if (error) {
      console.error('Ошибка получения статистики очереди:', error);
      return { pending: 0 };
    }

    return { pending: data ? data.length : 0 };
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
      console.error('Ошибка получения активных задач:', error);
      return [];
    }

    return data as DownloadTask[] || [];
  }
}