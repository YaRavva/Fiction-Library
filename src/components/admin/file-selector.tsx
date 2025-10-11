'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

interface FileSelectorProps {
  book: BookInfo;
  files: FileOption[];
  onSelect: (file: FileOption | null) => void;
  onSkip: () => void;
}

export function FileSelector({ book, files, onSelect, onSkip }: FileSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayedFiles, setDisplayedFiles] = useState<FileOption[]>([]);

  const handleSelect = useCallback(() => {
    if (isProcessing || selectedIndex >= displayedFiles.length) return;

    setIsProcessing(true);
    onSelect(displayedFiles[selectedIndex]);
  }, [isProcessing, selectedIndex, displayedFiles, onSelect]);

  const handleSkip = useCallback(() => {
    if (isProcessing) return;
    onSkip();
  }, [isProcessing, onSkip]);

  // Обновляем отображаемые файлы при изменении входных файлов или книги
  useEffect(() => {
    // Ограничиваем количество отображаемых файлов до 10
    const limitedFiles = files.slice(0, 10);
    setDisplayedFiles(limitedFiles);
    setSelectedIndex(0); // Сбрасываем выбор при обновлении файлов
    setIsProcessing(false);
  }, [files, book.id]);

  // Обработчик клавиш
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;

      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(displayedFiles.length - 1, prev + 1));
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
  }, [displayedFiles.length, handleSelect, handleSkip]);

  // Навешиваем обработчик клавиш
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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

  // Если нет файлов, не отображаем компонент
  if (displayedFiles.length === 0) {
    return null;
  }

  const selectedFile = displayedFiles[selectedIndex];

  return (
    <Card className="w-full max-w-4xl mx-auto h-full flex flex-col">
      <CardHeader className="py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            Выбор файла для книги
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            {selectedIndex + 1} из {displayedFiles.length}
          </Badge>
        </div>
        <CardDescription className="flex flex-col gap-1 text-sm py-1">
          <span><strong>Название:</strong> {book.title}</span>
          <span><strong>Автор:</strong> {book.author}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow overflow-hidden flex flex-col py-3">
        {/* Список файлов */}
        <div className="border rounded-md flex-grow overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-grow">
            <div className="p-2 space-y-2">
              {displayedFiles.map((file, index) => (
                <div
                  key={`${book.id}-${file.message_id}-${index}`}
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
                            Релевантность: {file.relevance_score}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          ID: {file.message_id}
                        </Badge>
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
          </div>
        </div>

        {/* Действия */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
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
      </CardContent>
    </Card>
  );
}