'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileSearch, Play, RotateCcw, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/browserSupabase';
import { FileOption } from './file-selector'; // Используем FileOption из file-selector

interface BookWithoutFile {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
}

interface ProcessingState {
  status: 'idle' | 'loading' | 'searching' | 'processing' | 'completed' | 'error';
  message: string;
}

export function FileSearchManager() {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: ''
  });
  const [error, setError] = useState<string | null>(null);

  const [booksWithoutFiles, setBooksWithoutFiles] = useState<BookWithoutFile[]>([]);
  const [currentBookIndex, setCurrentBookIndex] = useState(0);
  const [currentBookFiles, setCurrentBookFiles] = useState<FileOption[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [allTelegramFiles, setAllTelegramFiles] = useState<FileOption[]>([]);

  // Функция для логирования в окно результатов
  const logToResults = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const logMessage = `[${timestamp}] ${message}\n`;

    // Выводим в консоль для отладки
    console.log('FileSearchManager log:', message);

    // Отправляем в глобальное окно результатов
    if (typeof window !== 'undefined' && (window as any).setStatsUpdateReport) {
      try {
        (window as any).setStatsUpdateReport(logMessage);
        console.log('Message sent to results window:', message);
      } catch (error) {
        console.error('Error sending message to results window:', error);
      }
    } else {
      console.log('logToResults: setStatsUpdateReport not available, available window properties:', Object.keys(window || {}));
    }
  };

  // Получение токена авторизации
  const getAuthToken = async (): Promise<string> => {
    const supabase = getBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // Загрузка книг без файлов (тестовый режим для одной книги)
  const loadBooksWithoutFiles = async (): Promise<BookWithoutFile[]> => {
    logToResults('📚 Поиск конкретной книги для тестирования: "Цикл Иль-Рьен" Марты Уэллс...');

    const supabase = getBrowserSupabase();

    const { data, error: dbError } = await supabase
      .from('books')
      .select('id, title, author, publication_year')
      .eq('title', 'цикл Иль-Рьен')
      .eq('author', 'Марта Уэллс')
      .is('file_url', null)
      .limit(1);

    if (dbError) {
      logToResults(`❌ Ошибка при запросе книги: ${dbError.message}`);
      throw dbError;
    }

    const normalizedBooks = (data || []).map((book: any) => ({
      ...book,
      title: book.title.normalize('NFC'),
      author: book.author.normalize('NFC')
    }));

    if (normalizedBooks.length > 0) {
      logToResults(`✅ Тестовая книга найдена: "${normalizedBooks[0].title}" - ${normalizedBooks[0].author}`);
    } else {
      logToResults('❌ Тестовая книга не найдена или уже имеет файл.');
    }

    return normalizedBooks;
  };

  // Загрузка всех файлов из Telegram канала
  const loadTelegramFiles = async (): Promise<FileOption[]> => {
    logToResults('📂 Загрузка списка файлов из Telegram канала (пакетами по 1000 с паузой 1с)...');
    const token = await getAuthToken();

    const response = await fetch('/api/admin/telegram-files', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Не удалось загрузить файлы из Telegram');
    }

    const data = await response.json();
    logToResults(`📁 Всего загружено ${data.files?.length || 0} файлов из Telegram`);
    return data.files || [];
  };

  // Поиск подходящих файлов для книги
  const findMatchingFiles = (book: BookWithoutFile, files: FileOption[]): FileOption[] => {
    const normalizeString = (str: string) => str.normalize('NFC').toLowerCase();

    const bookTitle = normalizeString(book.title);
    const bookAuthor = normalizeString(book.author);

    logToResults(`🔍 Поиск файлов для книги: "${book.title}" автора: "${book.author}"`);
    logToResults(`📝 Нормализованное название (NFC): "${bookTitle}"`);
    logToResults(`👤 Нормализованный автор (NFC): "${bookAuthor}"`);

    const matchingFiles = files
      .map(file => {
        const filename = normalizeString(file.file_name || '');
        let score = 0;

        const titleWords = bookTitle.split(/\s+/).filter(word => word.length > 2);
        const authorWords = bookAuthor.split(/\s+/).filter(word => word.length > 2);

        let hasTitleMatch = false;
        let hasAuthorMatch = false;

        for (const word of titleWords) {
          if (filename.includes(word)) {
            hasTitleMatch = true;
            score += 10;
            break;
          }
        }

        for (const word of authorWords) {
          if (filename.includes(word)) {
            hasAuthorMatch = true;
            score += 10;
            break;
          }
        }

        if (!hasTitleMatch && !hasAuthorMatch) {
          return null;
        }


        return { ...file, relevance_score: score };
      })
      .filter((file): file is FileOption & { relevance_score: number } => file !== null)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 20);

    logToResults(`📊 Найдено ${matchingFiles.length} подходящих файлов для выбора.`);
    if (matchingFiles.length > 0) {
      matchingFiles.slice(0, 3).forEach((file, index) => {
        logToResults(`  ${index + 1}. "${file.file_name}" (релевантность: ${file.relevance_score})`);
      });
      if (matchingFiles.length > 3) {
        logToResults(`  ... и еще ${matchingFiles.length - 3} файлов`);
      }
    }

    return matchingFiles;
  };

  // Показать файлы для текущей книги
  const showFilesForCurrentBook = useCallback(async () => {
    if (booksWithoutFiles.length === 0) {
      logToResults('❌ Нет книг для обработки.');
      setProcessingState({ status: 'idle', message: 'Нет книг для обработки.' });
      return;
    }

    if (currentBookIndex < 0 || currentBookIndex >= booksWithoutFiles.length) {
      logToResults(`❌ Ошибка: индекс ${currentBookIndex} вне границ массива (0-${booksWithoutFiles.length - 1}).`);
      setProcessingState({ status: 'error', message: 'Ошибка: индекс книги вне границ массива.' });
      return;
    }

    const currentBook = booksWithoutFiles[currentBookIndex];
    if (!currentBook) {
      logToResults(`❌ Ошибка: книга с индексом ${currentBookIndex} равна null/undefined.`);
      setProcessingState({ status: 'error', message: 'Ошибка: книга не найдена.' });
      return;
    }

    logToResults(`\n📖 Книга ${currentBookIndex + 1}/${booksWithoutFiles.length}: "${currentBook.title}" - ${currentBook.author}`);
    const matchingFiles = findMatchingFiles(currentBook, allTelegramFiles);
    setCurrentBookFiles(matchingFiles);
    setSelectedFileIndex(0); // Выбираем первый файл по умолчанию

    if (matchingFiles.length === 0) {
      logToResults('❌ Подходящих файлов не найдено. Нажмите Enter для перехода к следующей книге.');
    } else {
      logToResults(`📁 Найдено ${matchingFiles.length} подходящих файлов:`);
      matchingFiles.forEach((file, index) => {
        const marker = index === selectedFileIndex ? '▶️' : '   ';
        logToResults(`${marker} ${index + 1}. ${file.file_name} (релевантность: ${file.relevance_score})`);
      });
    }

    logToResults('\n🎮 Управление: ↑↓ - навигация, Enter - выбрать, Esc - пропустить.');
    setProcessingState({ status: 'searching', message: 'Ожидание выбора пользователя...' });

  }, [booksWithoutFiles, currentBookIndex, allTelegramFiles, selectedFileIndex]); // Добавлен selectedFileIndex в зависимости

  // Обработка следующей книги (в тестовом режиме не используется, но сохранена для полной версии)
  const processNextBook = useCallback(async () => {
    const nextIndex = currentBookIndex + 1;
    if (nextIndex >= booksWithoutFiles.length) {
      logToResults(`🎉 Обработка завершена! Обработано ${booksWithoutFiles.length} книг.`);
      setProcessingState({ status: 'completed', message: 'Обработка завершена.' });
      return;
    }
    setCurrentBookIndex(nextIndex);
    setSelectedFileIndex(0); // Сброс выбранного файла для новой книги
    await showFilesForCurrentBook();
  }, [booksWithoutFiles, currentBookIndex, showFilesForCurrentBook]);

  // Обработка выбора файла
  const handleFileSelect = useCallback(async (fileToSelect: FileOption | null) => {
    logToResults(`🎯 Выбор файла: ${fileToSelect ? fileToSelect.file_name : 'ПРОПУСК'}`);

    if (!fileToSelect) {
      logToResults('⏭️ Файл не выбран, переходим к следующей книге.');
      await processNextBook();
      return;
    }

    const currentBook = booksWithoutFiles[currentBookIndex];
    if (!currentBook) {
      logToResults(`❌ Ошибка: текущая книга не найдена при выборе файла.`);
      setProcessingState({ status: 'error', message: 'Ошибка: текущая книга не найдена.' });
      return;
    }

    logToResults(`📤 Загрузка файла "${fileToSelect.file_name}" для книги "${currentBook.title}"...`);
    setProcessingState({ status: 'processing', message: 'Загрузка и привязка файла...' });

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/file-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookId: currentBook.id,
          fileMessageId: fileToSelect.message_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка при загрузке файла');
      }

      logToResults(`✅ Файл успешно привязан к книге "${currentBook.title}"!`);
      // Для тестового режима, завершаем после одной книги
      logToResults('🎉 Тестовая обработка завершена! Книга успешно обработана.');
      setProcessingState({ status: 'completed', message: 'Тестовая обработка завершена.' });

    } catch (error: any) {
      logToResults(`❌ Ошибка при привязке файла: ${error.message}`);
      setProcessingState({ status: 'error', message: `Ошибка: ${error.message}` });
      // Для тестового режима, завершаем после одной книги
      logToResults('🎉 Тестовая обработка завершена с ошибкой.');
    }
  }, [booksWithoutFiles, currentBookIndex, getAuthToken, processNextBook, setProcessingState, showFilesForCurrentBook]);

  // Пропуск книги
  const handleSkipBook = useCallback(async () => {
    const currentBook = booksWithoutFiles[currentBookIndex];
    if (currentBook) {
      logToResults(`⏭️ Книга "${currentBook.title}" пропущена пользователем.`);
    } else {
      logToResults('⏭️ Книга пропущена (не найдена).');
    }
    logToResults('🎉 Тестовая обработка завершена (книга пропущена).');
    setProcessingState({ status: 'completed', message: 'Тестовая обработка завершена.' });
  }, [booksWithoutFiles, currentBookIndex, setProcessingState, processNextBook]);


  // Обработчик клавиш
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    if (processingState.status !== 'searching') return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setSelectedFileIndex(prev => {
          const newIndex = Math.max(0, prev - 1);
          logToResults(`↑ Выбран файл: ${currentBookFiles[newIndex]?.file_name}`);
          return newIndex;
        });
        await showFilesForCurrentBook(); // Обновляем отображение маркера
        break;

      case 'ArrowDown':
        event.preventDefault();
        setSelectedFileIndex(prev => {
          const newIndex = Math.min(currentBookFiles.length - 1, prev + 1);
          logToResults(`↓ Выбран файл: ${currentBookFiles[newIndex]?.file_name}`);
          return newIndex;
        });
        await showFilesForCurrentBook(); // Обновляем отображение маркера
        break;

      case 'Enter':
        event.preventDefault();
        if (currentBookFiles.length > 0) {
          await handleFileSelect(currentBookFiles[selectedFileIndex]);
        } else {
          // Если файлов нет, завершаем тестовую обработку
          logToResults('❌ Подходящих файлов не найдено. Тестовая обработка завершена.');
          setProcessingState({ status: 'completed', message: 'Тестовая обработка завершена.' });
        }
        break;

      case 'Escape':
        event.preventDefault();
        await handleSkipBook();
        break;
    }
  }, [processingState.status, currentBookFiles, selectedFileIndex, handleFileSelect, handleSkipBook, showFilesForCurrentBook]);

  // Навешиваем обработчик клавиш при активации поиска
  useEffect(() => {
    if (processingState.status === 'searching') {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return () => {};
  }, [processingState.status, handleKeyDown]);


  // Запуск интерактивного поиска
  const startInteractiveFileSearch = async () => {
    if (processingState.status !== 'idle' && processingState.status !== 'completed' && processingState.status !== 'error') return;

    logToResults('🚀 Запуск интерактивного поиска файлов...');
    setProcessingState({ status: 'loading', message: 'Загрузка книг без файлов...' });
    setError(null);

    try {
      // Шаг 1: Получаем книги без файлов
      const books = await loadBooksWithoutFiles();
      setBooksWithoutFiles(books);

      if (books.length === 0) {
        logToResults('✅ Все книги уже имеют файлы или тестовая книга не найдена.');
        setProcessingState({ status: 'idle', message: 'Нет книг для обработки.' });
        return;
      }

      // Шаг 2: Загружаем полный список файлов из Telegram
      setProcessingState({ status: 'searching', message: 'Загрузка списка файлов из Telegram...' });
      const telegramFiles = await loadTelegramFiles();
      setAllTelegramFiles(telegramFiles);

      // Шаг 3: Начинаем обработку первой книги
      logToResults('🎯 Шаг 3: Начало интерактивной обработки книги...');
      setCurrentBookIndex(0);
      setSelectedFileIndex(0);
      await showFilesForCurrentBook();

    } catch (err: any) {
      console.error('Ошибка интерактивного поиска:', err);
      logToResults(`❌ Ошибка запуска: ${err.message}`);
      setError(`Ошибка: ${err.message}`);
      setProcessingState({ status: 'error', message: `Ошибка: ${err.message}` });
    }
  };


  // Сброс состояния
  const handleReset = useCallback(() => {
    logToResults('🔄 Сброс состояния поиска файлов...');
    setProcessingState({ status: 'idle', message: '' });
    setError(null);
    setBooksWithoutFiles([]);
    setCurrentBookIndex(0);
    setCurrentBookFiles([]);
    setSelectedFileIndex(0);
    setAllTelegramFiles([]);
    logToResults('✅ Состояние сброшено.');
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Полуавтоматический поиск файлов
        </CardTitle>
        <CardDescription>
          ТЕСТОВЫЙ РЕЖИМ: Обработка только книги "Цикл Иль-Рьен" Марты Уэллс
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2">
          <Button
            onClick={startInteractiveFileSearch}
            disabled={processingState.status === 'loading' || processingState.status === 'searching' || processingState.status === 'processing'}
          >
            {processingState.status === 'loading' || processingState.status === 'searching' || processingState.status === 'processing' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {processingState.status === 'loading' ? 'Загрузка...' : 'Поиск/Обработка...'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Начать интерактивный поиск
              </>
            )}
          </Button>

          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Сброс
          </Button>
        </div>

        {/* Здесь не будет выводиться никаких сообщений, только кнопки */}
        {/* Все сообщения будут выводиться в глобальное окно "Результаты" */}
      </CardContent>
    </Card>
  );
}