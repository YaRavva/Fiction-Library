'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileSearch, Play, RotateCcw, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/browserSupabase';
import { FileOption, FileSelector } from './file-selector'; // Импортируем FileSelector и FileOption
import { Portal } from './portal'; // Импортируем Portal

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
  const [showFileSelector, setShowFileSelector] = useState(false); // Состояние для отображения FileSelector

  // Функция для логирования в окно результатов
  const logToResults = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const logMessage = `[${timestamp}] ${message}\n`;

    // Выводим в консоль для отладки
    console.log('FileSearchManager log:', message);

    // Проверяем, доступна ли родительская функция обновления результатов
    if (typeof window !== 'undefined' && (window as any).updateFileSearchResults) {
      try {
        (window as any).updateFileSearchResults(logMessage);
        console.log('✅ Message sent to results window:', message);
      } catch (error) {
        console.error('❌ Error sending message to results window:', error);
        console.error('Available window properties:', Object.keys(window || {}));
      }
    } else {
      console.log('❌ updateFileSearchResults not available');
      console.log('Available window properties:', Object.keys(window || {}));
    }
  };

  // Добавляем функцию для прямого логирования в консоль браузера
  const logToConsole = (message: string) => {
    console.log(`🔍 FileSearch: ${message}`);
  };

  // Получение токена авторизации
  const getAuthToken = async (): Promise<string> => {
    const supabase = getBrowserSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`Ошибка получения сессии: ${error.message}`);
    }
    
    if (!session || !session.access_token) {
      throw new Error('Токен авторизации не найден');
    }
    
    return session.access_token;
  };

  // Загрузка книг без файлов (обработка всех книг без файлов)
  const loadBooksWithoutFiles = async (): Promise<BookWithoutFile[]> => {
    logToResults('📚 Поиск всех книг без файлов...');

    const supabase = getBrowserSupabase();

    try {
      // Получаем все книги без файлов
      const { data, error: dbError } = await supabase
        .from('books')
        .select('id, title, author, publication_year')
        .is('file_url', null)
        .order('author', { ascending: true })
        .order('title', { ascending: true });

      if (dbError) {
        logToResults(`❌ Ошибка при запросе книг: ${dbError.message}`);
        throw new Error(`Ошибка базы данных: ${dbError.message}`);
      }

      logToResults(`📊 Найдено ${data?.length || 0} книг без файлов`);
      
      if (data && data.length > 0) {
        return data;
      } else {
        logToResults('❌ В базе данных нет книг без файлов.');
        return []; // Возвращаем пустой массив
      }
    } catch (err: any) {
      // Более детальнаяльная обработка ошибок
      console.error('Ошибка при загрузке книг без файлов:', err);
      
      // Попытка получить больше информации об ошибке
      let errorMessage = 'Неизвестная ошибка при поиске книг';
      if (err && typeof err === 'object') {
        if (err.message) {
          errorMessage = err.message;
        } else if (Object.keys(err).length > 0) {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      logToResults(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
  };

  // Загрузка всех файлов из Telegram канала
  const loadTelegramFiles = async (): Promise<FileOption[]> => {
    logToResults('📂 Загрузка списка файлов из Telegram канала (пакетами по 1000 с паузой 1с)...');
    const token = await getAuthToken();

    try {
      const response = await fetch('/api/admin/telegram-files', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ошибка: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      logToResults(`📁 Всего загружено ${data.files?.length || 0} файлов из Telegram`);
      
      return data.files || [];
    } catch (err: any) {
      // Более детальная обработка ошибок
      console.error('Ошибка при загрузке файлов из Telegram:', err);
      
      // Попытка получить больше информации об ошибке
      let errorMessage = 'Не удалось загрузить файлы из Telegram';
      if (err && typeof err === 'object') {
        if (err.message) {
          errorMessage = err.message;
        } else if (Object.keys(err).length > 0) {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      logToResults(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
  };

  // Показать файлы для текущей книги
  const showFilesForCurrentBook = useCallback(async (books: BookWithoutFile[], files: FileOption[] = []) => {
    if (books.length === 0) {
      logToResults('❌ Нет книг для обработки.');
      setProcessingState({ status: 'idle', message: 'Нет книг для обработки. Попробуйте обновить список книг.' });
      return;
    }

    if (currentBookIndex < 0 || currentBookIndex >= books.length) {
      logToResults(`❌ Ошибка: индекс ${currentBookIndex} вне границ массива (0-${books.length - 1}).`);
      setProcessingState({ status: 'error', message: 'Ошибка: индекс книги вне границ массива.' });
      return;
    }

    const currentBook = books[currentBookIndex];
    
    if (!currentBook) {
      logToResults(`❌ Ошибка: книга с индексом ${currentBookIndex} равна null/undefined.`);
      setProcessingState({ status: 'error', message: 'Ошибка: книга не найдена.' });
      return;
    }

    logToResults(`📚 Текущая книга: Название: ${currentBook.title} Автор: ${currentBook.author}`);
    
    // Используем переданные файлы, если они есть, иначе используем состояние
    const filesToUse = files.length > 0 ? files : allTelegramFiles;
    
    const matchingFiles = findMatchingFiles(currentBook, filesToUse);
    
    // Устанавливаем новые файлы
    setCurrentBookFiles(matchingFiles);
    setSelectedFileIndex(0); // Выбираем первый файл по умолчанию

    if (matchingFiles.length === 0) {
      logToResults('❌ Подходящих файлов не найдено. Автоматический переход к следующей книге через 2 секунды...');
      // Переходим к следующей книге, если нет подходящих файлов
      setTimeout(() => {
        // Вызываем processNextBook через функцию состояния
        setCurrentBookIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= booksWithoutFiles.length) {
            logToResults('🎉 Обработка завершена! Книга успешно обработана.');
            setProcessingState({ status: 'completed', message: 'Обработка завершена.' });
            setShowFileSelector(false); // Скрываем FileSelector при завершении
            return prevIndex;
          }
          // Показываем файлы для следующей книги
          setTimeout(() => {
            showFilesForCurrentBook(booksWithoutFiles, allTelegramFiles);
          }, 0);
          return nextIndex;
        });
      }, 2000);
    } else {
      // Показываем FileSelector для выбора файла
      setShowFileSelector(true);
    }

    setProcessingState({ status: 'searching', message: 'Ожидание выбора пользователя...' });

  }, [currentBookIndex, allTelegramFiles, booksWithoutFiles, setSelectedFileIndex, setCurrentBookFiles, setShowFileSelector, setProcessingState, logToResults]);

  // Обработка следующей книги
  const processNextBook = useCallback(async () => {
    const nextIndex = currentBookIndex + 1;
    if (nextIndex >= booksWithoutFiles.length) {
      logToResults('🎉 Обработка завершена! Книга успешно обработана.');
      setProcessingState({ status: 'completed', message: 'Обработка завершена.' });
      return;
    }
    
    // Сначала скрываем FileSelector
    setShowFileSelector(false);
    
    // Обновляем индекс книги
    setCurrentBookIndex(nextIndex);
    setSelectedFileIndex(0); // Сброс выбранного файла для новой книги
    
    // Ждем следующего рендера
    setTimeout(() => {
      showFilesForCurrentBook(booksWithoutFiles, allTelegramFiles);
    }, 0);
  }, [booksWithoutFiles, currentBookIndex, showFilesForCurrentBook, allTelegramFiles, setSelectedFileIndex, setShowFileSelector, logToResults, setProcessingState]);

  // Поиск подходящих файлов для книги
  const findMatchingFiles = (book: BookWithoutFile, files: FileOption[]): FileOption[] => {
    // Нормализуем только имена файлов, а не названия и авторов книг
    const normalizeString = (str: string) => str.normalize('NFC').toLowerCase();

    // Для названий и авторов книг используем обычное приведение к нижнему регистру
    const bookTitle = book.title.toLowerCase();
    const bookAuthor = book.author.toLowerCase();

    // Улучшенное разбиение на слова с учетом различных разделителей и специальных символов
    const extractWords = (str: string): string[] => {
      // Разбиваем по различным разделителям: пробелы, дефисы, скобки, точки и т.д.
      return str
        .split(/[\s\-_\(\)\[\]\{\}\/\\\.]+/)
        .filter(word => word.length > 1) // Игнорируем слова короче 2 символов
        .map(word => word.trim())
        .filter(word => word.length > 0);
    };

    // Извлекаем слова из названия и автора книги
    const titleWords = extractWords(bookTitle);
    const authorWords = extractWords(bookAuthor);
    
    // Добавляем специальные слова для поиска
    const specialTitleWords = [...titleWords];
    const specialAuthorWords = [...authorWords];
    
    // Обрабатываем специальные случаи
    if (bookTitle.includes('иль-рьен')) {
      specialTitleWords.push('иль', 'рьен', 'иль-рьен');
    }
    
    if (bookAuthor.includes('марта')) {
      specialAuthorWords.push('марта', 'уэллс');
    }

    let matchingFiles = files
      .map(file => {
        // Нормализуем только имя файла
        const filename = normalizeString(file.file_name || '');
        let score = 0;

        let hasTitleMatch = false;
        let hasAuthorMatch = false;

        // Проверяем совпадения по названию
        for (const word of specialTitleWords) {
          // Используем регулярное выражение для более гибкого поиска
          const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(filename)) {
            hasTitleMatch = true;
            score += 10;
          } else {
            // Проверяем частичное совпадение
            if (filename.includes(word)) {
              hasTitleMatch = true;
              score += 5;
            }
          }
        }

        // Проверяем совпадения по автору
        for (const word of specialAuthorWords) {
          // Используем регулярное выражение для более гибкого поиска
          const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(filename)) {
            hasAuthorMatch = true;
            score += 10;
          } else {
            // Проверяем частичное совпадение
            if (filename.includes(word)) {
              hasAuthorMatch = true;
              score += 5;
            }
          }
        }

        if (!hasTitleMatch && !hasAuthorMatch) {
          return null;
        }

        return { ...file, relevance_score: score };
      })
      .filter((file): file is FileOption & { relevance_score: number } => file !== null)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 10); // Ограничиваем до 10 самых релевантных файлов

    return matchingFiles;
  };

  // Обработка выбора файла
  const handleFileSelect = useCallback(async (fileToSelect: FileOption | null) => {
    // Скрываем FileSelector
    setShowFileSelector(false);
    
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
        const errorMessage = errorData.error || `HTTP ошибка: ${response.status} ${response.statusText}`;
        
        // Если файл уже существует, пробуем привязать существующий файл
        if (errorMessage.includes('The resource already exists')) {
          logToResults(`ℹ️ Файл уже существует в хранилище, пробуем привязать существующий файл к книге "${currentBook.author}: ${currentBook.title}"...`);
          
          // Делаем запрос для привязки существующего файла
          const linkResponse = await fetch('/api/admin/file-link-existing', {
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
          
          if (!linkResponse.ok) {
            const linkErrorData = await linkResponse.json().catch(() => ({}));
            const linkErrorMessage = linkErrorData.error || `HTTP ошибка: ${linkResponse.status} ${linkResponse.statusText}`;
            
            // Если файл не соответствует ожиданиям, загружаем новый
            if (linkErrorMessage === 'FILE_MISMATCH_NEEDS_REUPLOAD' || linkResponse.status === 422) {
              logToResults(`⚠️ Файл не соответствует ожиданиям, загружаем новый файл для книги "${currentBook.author}: ${currentBook.title}"...`);
              
              // Повторно вызываем оригинальный endpoint для загрузки нового файла
              const retryResponse = await fetch('/api/admin/file-link', {
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
              
              if (!retryResponse.ok) {
                const retryErrorData = await retryResponse.json().catch(() => ({}));
                const retryErrorMessage = retryErrorData.error || `HTTP ошибка: ${retryResponse.status} ${retryResponse.statusText}`;
                throw new Error(retryErrorMessage);
              }
              
              const result = await retryResponse.json();
              logToResults(`✅ Новый файл успешно загружен и привязан к книге "${currentBook.author}: ${currentBook.title}"!`);
            } else {
              throw new Error(linkErrorMessage);
            }
          } else {
            const result = await linkResponse.json();
            logToResults(`✅ Существующий файл успешно привязан к книге "${currentBook.author}: ${currentBook.title}"!`);
          }
        } else {
          logToResults(`❌ Ошибка при привязке файла: ${errorMessage}`);
          throw new Error(errorMessage);
        }
      } else {
        const result = await response.json();
        logToResults(`✅ Файл успешно привязан к книге "${currentBook.author}: ${currentBook.title}"!`);
      }
      
      // Переходим к следующей книге
      await processNextBook();

    } catch (err: any) {
      // Более детальная обработка ошибок
      console.error('Ошибка при привязке файла:', err);
      
      // Попытка получить больше информации об ошибке
      let errorMessage = 'Неизвестная ошибка при привязке файла';
      if (err && typeof err === 'object') {
        if (err.message) {
          errorMessage = err.message;
        } else if (Object.keys(err).length > 0) {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      logToResults(`❌ Ошибка при привязке файла: ${errorMessage}`);
      setProcessingState({ status: 'error', message: `Ошибка: ${errorMessage}` });
      // Переходим к следующей книге
      await processNextBook();
    }
  }, [booksWithoutFiles, currentBookIndex, getAuthToken, processNextBook, setProcessingState, showFilesForCurrentBook]);

  // Пропуск книги
  const handleSkipBook = useCallback(async () => {
    // Скрываем FileSelector
    setShowFileSelector(false);
    
    logToResults('⏭️ Пользователь выбрал пропустить книгу');
    
    const currentBook = booksWithoutFiles[currentBookIndex];
    if (currentBook) {
      logToResults(`⏭️ Книга "${currentBook.title}" пропущена пользователем.`);
    } else {
      logToResults('⏭️ Книга пропущена (не найдена).');
    }
    
    // Переходим к следующей книге
    await processNextBook();
  }, [booksWithoutFiles, currentBookIndex, processNextBook]);

  // Запуск интерактивного поиска
  const startInteractiveFileSearch = async () => {
    if (processingState.status !== 'idle' && processingState.status !== 'completed' && processingState.status !== 'error') {
      return;
    }

    logToResults('🚀 Запуск интерактивного поиска файлов...');
    setProcessingState({ status: 'loading', message: 'Загрузка книг без файлов...' });
    setError(null);

    try {
      // Шаг 1: Получаем книги без файлов
      const books = await loadBooksWithoutFiles();
      setBooksWithoutFiles(books);

      if (books.length === 0) {
        setProcessingState({ status: 'idle', message: 'Нет книг для обработки. Попробуйте обновить список книг.' });
        return;
      }

      // Шаг 2: Загружаем полный список файлов из Telegram
      setProcessingState({ status: 'loading', message: 'Загрузка списка файлов из Telegram...' });
      const telegramFiles = await loadTelegramFiles();
      setAllTelegramFiles(telegramFiles);

      // Проверяем, что файлы были загружены
      if (telegramFiles.length === 0) {
        setProcessingState({ status: 'error', message: 'Не удалось загрузить файлы из Telegram.' });
        return;
      }

      // Шаг 3: Начинаем обработку первой книги
      setCurrentBookIndex(0);
      setSelectedFileIndex(0);
      await showFilesForCurrentBook(books, telegramFiles); // Передаем книги и файлы напрямую

    } catch (err: any) {
      // Более детальная обработка ошибок
      console.error('Ошибка интерактивного поиска:', err);
      
      // Попытка получить больше информации об ошибке
      let errorMessage = 'Неизвестная ошибка';
      if (err && typeof err === 'object') {
        if (err.message) {
          errorMessage = err.message;
        } else if (Object.keys(err).length > 0) {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(`Ошибка: ${errorMessage}`);
      setProcessingState({ status: 'error', message: `Ошибка: ${errorMessage}` });
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
    setShowFileSelector(false); // Скрываем FileSelector при сбросе
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
          Обработка всех книг без файлов
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

        {/* Модальное окно для FileSelector через портал */}
        {showFileSelector && booksWithoutFiles.length > 0 && currentBookIndex < booksWithoutFiles.length && (
          <Portal>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
                <FileSelector
                  key={`${currentBookIndex}-${booksWithoutFiles[currentBookIndex].id}-${currentBookFiles.length}`}
                  book={{
                    id: booksWithoutFiles[currentBookIndex].id,
                    title: booksWithoutFiles[currentBookIndex].title,
                    author: booksWithoutFiles[currentBookIndex].author,
                    publication_year: booksWithoutFiles[currentBookIndex].publication_year,
                  }}
                  files={currentBookFiles}
                  onSelect={handleFileSelect}
                  onSkip={handleSkipBook}
                  isVisible={showFileSelector}
                />
              </div>
            </div>
          </Portal>
        )}

        {/* Здесь не будет выводиться никаких сообщений, только кнопки */}
        {/* Все сообщения будут выводиться в глобальное окно "Результаты" */}
      </CardContent>
    </Card>
  );
}
