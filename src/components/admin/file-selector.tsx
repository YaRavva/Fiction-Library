'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, SkipForward, Check } from 'lucide-react';

export interface FileOption {
  message_id: number;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  caption?: string;
  date: number;
  relevance_score?: number;
}

export interface BookInfo {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
  series_title?: string;
  series_order?: number;
}

interface FileSelectorProps {
  book: BookInfo;
  files: FileOption[];
  onSelect: (file: FileOption | null) => void;
  onSkip: () => void;
  isVisible: boolean;
}

export function FileSelector({ book, files, onSelect, onSkip, isVisible }: FileSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Сброс выбранного индекса при смене книги или файлов
  useEffect(() => {
    setSelectedIndex(0);
  }, [book.id, files.length]);

  // Обработчик клавиш
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isVisible || isProcessing) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;

      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(files.length - 1, prev + 1));
        break;

      case 'Enter':
        event.preventDefault();
        handleSelect();
        break;

      case 'Escape':
        event.preventDefault();
        handleSkip();
        break;
    }
  }, [isVisible, isProcessing, files.length, selectedIndex]);

  // Навешиваем обработчик клавиш
  useEffect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, isVisible]);

  const handleSelect = async () => {
    if (isProcessing || selectedIndex >= files.length) return;

    setIsProcessing(true);
    try {
      await onSelect(files[selectedIndex]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    if (isProcessing) return;
    onSkip();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Неизвестен';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isVisible || files.length === 0) {
    return null;
  }

  const selectedFile = files[selectedIndex];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Выбор файла для книги
        </CardTitle>
        <CardDescription>
          {book.title} - {book.author}
          {book.publication_year && ` (${book.publication_year})`}
          {book.series_title && ` • ${book.series_title}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Управление */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>↑↓ Навигация</span>
            <span>Enter - Выбрать</span>
            <span>Esc - Пропустить</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {selectedIndex + 1} из {files.length}
            </Badge>
          </div>
        </div>

        {/* Список файлов */}
        <ScrollArea className="h-96 border rounded-md">
          <div className="p-2 space-y-1">
            {files.map((file, index) => (
              <div
                key={file.message_id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {file.file_name || `Файл ${file.message_id}`}
                      </span>
                      {file.relevance_score && (
                        <Badge variant="secondary" className="text-xs">
                          {file.relevance_score} баллов
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span>Размер: {formatFileSize(file.file_size)}</span>
                        <span>Дата: {formatDate(file.date)}</span>
                      </div>

                      {file.caption && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs truncate">
                          {file.caption}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {file.mime_type && (
                      <Badge variant="outline" className="text-xs">
                        {file.mime_type.split('/').pop()?.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Действия */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkip}
              disabled={isProcessing}
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Пропустить (Esc)
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              Выбран: {selectedFile?.file_name || 'Нет'}
            </div>
            <Button
              onClick={handleSelect}
              disabled={isProcessing}
              size="sm"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Выбрать (Enter)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Подсказка */}
        <div className="text-xs text-muted-foreground text-center">
          Используйте стрелки ↑↓ для навигации, Enter для выбора файла, Esc для пропуска книги
        </div>
      </CardContent>
    </Card>
  );
}