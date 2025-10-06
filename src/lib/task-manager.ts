import { createClient } from '@supabase/supabase-js';

// Типы для задач
export interface TaskProgress {
  progress: number;
  message: string;
  result?: any;
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Простой in-memory менеджер задач (в реальном приложении лучше использовать Redis или базу данных)
class TaskManager {
  private tasks: Map<string, TaskStatus> = new Map();
  private progressCallbacks: Map<string, (progress: TaskProgress) => void> = new Map();

  // Создает новую задачу
  createTask(id: string): TaskStatus {
    const task: TaskStatus = {
      id,
      status: 'pending',
      progress: 0,
      message: 'Task created',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tasks.set(id, task);
    return task;
  }

  // Обновляет статус задачи
  updateTaskStatus(id: string, status: 'running' | 'completed' | 'failed', message?: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      if (message) {
        task.message = message;
      }
      task.updatedAt = new Date();
      this.tasks.set(id, task);
    }
  }

  // Обновляет прогресс задачи
  updateTaskProgress(id: string, progress: number, message: string, result?: any): void {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      task.message = message;
      if (result) {
        task.result = result;
      }
      task.updatedAt = new Date();
      this.tasks.set(id, task);
      
      // Вызываем callback, если он зарегистрирован
      const callback = this.progressCallbacks.get(id);
      if (callback) {
        callback({ progress, message, result });
      }
    }
  }

  // Получает статус задачи
  getTaskStatus(id: string): TaskStatus | undefined {
    return this.tasks.get(id);
  }

  // Регистрирует callback для прогресса задачи
  registerProgressCallback(id: string, callback: (progress: TaskProgress) => void): void {
    this.progressCallbacks.set(id, callback);
  }

  // Удаляет callback для прогресса задачи
  unregisterProgressCallback(id: string): void {
    this.progressCallbacks.delete(id);
  }
}

export const taskManager = new TaskManager();