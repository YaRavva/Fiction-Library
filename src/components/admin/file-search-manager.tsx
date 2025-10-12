'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileSearch, Play, RotateCcw, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/browserSupabase';
import { FileOption, FileSelector } from './file-selector';

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
  const [isResetting, setIsResetting] = useState(false); // Флаг для отслеживания сброса

  const [booksWithoutFiles, setBooksWithoutFiles] = useState<BookWithoutFile[]>([]);
  const [currentBookIndex, setCurrentBookIndex] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectorKey, setFileSelectorKey] = useState(0); // Состояние-флаг для перерендеринга FileSelector

  // Используем useRef для хранения файлов вместо состояния
  const allTelegramFilesRef = useRef<FileOption[]>([]);
  const currentBookFilesRef = useRef<FileOption[]>([]);
  
  // Добавляем ref для хранения информации о текущей книге на момент открытия селектора
  const currentBookRef = useRef<BookWithoutFile | null>(null);

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

  // Очистка привязки файла к книге
  const clearFileLink = async (bookId: string): Promise<void> => {
    const token = await getAuthToken();
    
    const response = await fetch('/api/admin/clear-file-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ошибка: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    logToResults(`✅ ${result.message}`);
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
      
      // Сохраняем файлы в ref вместо состояния
      const files = data.files || [];
      allTelegramFilesRef.current = files;
      
      return files;
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

    // Убираем дублирующее сообщение "Текущая книга", оставляем только при актуализации
    // logToResults(`📚 Текущая книга: ${currentBook.author} - ${currentBook.title}`);
    
    // Сохраняем информацию о текущей книге в ref
    currentBookRef.current = currentBook;
    
    // Используем переданные файлы, если они есть, иначе используем ref
    const filesToUse = files.length > 0 ? files : allTelegramFilesRef.current;
    
    const matchingFiles = findMatchingFiles(currentBook, filesToUse);
    
    // Важно: устанавливаем файлы непосредственно перед отображением компонента
    // Устанавливаем новые файлы в ref
    currentBookFilesRef.current = matchingFiles;
    setSelectedFileIndex(0); // Выбираем первый файл по умолчанию
    
    // Увеличиваем ключ для полного перерендеринга FileSelector
    setFileSelectorKey(prev => prev + 1);

    if (matchingFiles.length === 0) {
      logToResults('❌ Подходящих файлов не найдено. Автоматический переход к следующей книге через 2 секунды...');
      // Переходим к следующей книге, если нет подходящих файлов
      setTimeout(() => {
        // Вызываем processNextBook через функцию состояния
        setCurrentBookIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= books.length) {
            logToResults('🎉 Обработка завершена! Книга успешно обработана.');
            setProcessingState({ status: 'completed', message: 'Обработка завершена.' });
            setShowFileSelector(false); // Скрываем FileSelector при завершении
            return prevIndex;
          }
          // Показываем файлы для следующей книги
          setTimeout(() => {
            showFilesForCurrentBook(books, allTelegramFilesRef.current);
          }, 0);
          return nextIndex;
        });
      }, 2000);
    } else {
      // Показываем FileSelector для выбора файла
      setShowFileSelector(true);
    }

    setProcessingState({ status: 'searching', message: 'Ожидание выбора пользователя...' });

  }, [currentBookIndex, booksWithoutFiles, setSelectedFileIndex, setShowFileSelector, setProcessingState, logToResults, setFileSelectorKey]);

  // Обработка следующей книги
  const processNextBook = useCallback(async () => {
    // Проверяем флаг сброса
    if (isResetting) {
      logToResults('⏹️ Процесс прерван пользователем (сброс).');
      setIsResetting(false);
      return;
    }
    
    const nextIndex = currentBookIndex + 1;
    if (nextIndex >= booksWithoutFiles.length) {
      logToResults('🎉 Обработка завершена! Книга успешно обработана.');
      setProcessingState({ status: 'completed', message: 'Обработка завершена.' });
      setShowFileSelector(false); // Скрываем FileSelector при завершении
      setFileSelectorKey(prev => prev + 1); // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
      return;
    }
    
    // Сначала скрываем FileSelector
    setShowFileSelector(false);
    // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
    setFileSelectorKey(prev => prev + 1);
    
    // Обновляем индекс книги и информацию о текущей книге в ref
    setCurrentBookIndex(nextIndex);
    setSelectedFileIndex(0); // Сброс выбранного файла для новой книги
    
    // Обновляем информацию о текущей книге в ref сразу после изменения индекса
    if (nextIndex < booksWithoutFiles.length) {
      currentBookRef.current = booksWithoutFiles[nextIndex];
      // Убираем дублирующее сообщение, оставляем только при актуализации
    }
    
    // Ждем следующего рендера и показываем файлы для следующей книги
    setTimeout(() => {
      showFilesForCurrentBook(booksWithoutFiles, allTelegramFilesRef.current);
    }, 0);
  }, [booksWithoutFiles, currentBookIndex, showFilesForCurrentBook, setSelectedFileIndex, setShowFileSelector, logToResults, setProcessingState, setFileSelectorKey, isResetting, setIsResetting, currentBookRef]);

  // Поиск подходящих файлов для книги
  const findMatchingFiles = (book: BookWithoutFile, files: FileOption[]): FileOption[] => {
    // Нормализуем строки для корректного сравнения
    const normalizeString = (str: string) => {
      // Нормализуем в NFC форму и приводим к нижнему регистру
      let normalized = str.normalize('NFC').toLowerCase();
      // Заменяем "ё" на "е" для улучшенного поиска
      normalized = normalized.replace(/ё/g, 'е');
      return normalized;
    };

    // Нормализуем название и автора книги
    const bookTitle = normalizeString(book.title);
    const bookAuthor = normalizeString(book.author);

    // Улучшенное разбиение на слова с учетом различных разделителей
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

    // Создаем регулярные выражения для более точного поиска
    const createRegex = (word: string) => {
      // Экранируем специальные символы
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedWord, 'i');
    };

    let matchingFiles = files
      .filter(file => {
        // Отсеиваем файлы с типом application/octet-stream, так как они могут иметь ошибочную кодировку
        if (file.mime_type === 'application/octet-stream') {
          return false;
        }
        return true;
      })
      .map(file => {
        // Нормализуем имя файла
        const filename = normalizeString(file.file_name || '');
        let score = 0;
        let titleMatches = 0;
        let authorMatches = 0;

        // Проверяем совпадения по названию книги
        for (const word of titleWords) {
          const regex = createRegex(word);
          if (regex.test(filename)) {
            titleMatches++;
            score += 15; // Высокий вес для точного совпадения слов названия
          }
        }

        // Проверяем совпадения по автору книги
        for (const word of authorWords) {
          const regex = createRegex(word);
          if (regex.test(filename)) {
            authorMatches++;
            score += 12; // Высокий вес для точного совпадения слов автора
          }
        }

        // Проверяем точное совпадение полного названия книги (если название не слишком короткое)
        if (bookTitle.length > 5 && filename.includes(bookTitle)) {
          score += 20; // Очень высокий вес для точного совпадения названия
        }

        // Проверяем точное совпадение автора (если имя автора не слишком короткое)
        if (bookAuthor.length > 5 && filename.includes(bookAuthor)) {
          score += 18; // Очень высокий вес для точного совпадения автора
        }

        // Файл должен содержать хотя бы одно слово из названия ИЛИ автора
        if (titleMatches === 0 && authorMatches === 0) {
          return null;
        }

        // Бонус за формат файла (fb2 и zip предпочтительнее)
        if (filename.endsWith('.fb2')) {
          score += 5;
        } else if (filename.endsWith('.zip')) {
          score += 3;
        }

        return { ...file, relevance_score: score };
      })
      .filter((file): file is FileOption & { relevance_score: number } => file !== null)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 15); // Увеличиваем до 15 самых релевантных файлов

    return matchingFiles;
  };

  // Обработка выбора файла
  const handleFileSelect = useCallback(async (fileToSelect: FileOption | null) => {
    // Проверяем флаг сброса
    if (isResetting) {
      logToResults('⏹️ Процесс прерван пользователем (сброс).');
      setIsResetting(false);
      setShowFileSelector(false);
      setFileSelectorKey(prev => prev + 1);
      return;
    }
    
    // Скрываем FileSelector
    setShowFileSelector(false);
    // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
    setFileSelectorKey(prev => prev + 1);
    
    logToResults(`🎯 Выбор файла: ${fileToSelect ? fileToSelect.file_name : 'ПРОПУСК'}`);

    if (!fileToSelect) {
      logToResults('⏭️ Файл не выбран, переходим к следующей книге.');
      await processNextBook();
      return;
    }

    // Получаем информацию о текущей книге из ref или состояния
    let currentBook = currentBookRef.current;
    if (!currentBook || currentBook.id !== booksWithoutFiles[currentBookIndex]?.id) {
      // Если ref пуст или не соответствует текущей книге, используем книгу из состояния
      if (currentBookIndex < booksWithoutFiles.length) {
        currentBook = booksWithoutFiles[currentBookIndex];
        // Обновляем ref для будущих обращений
        currentBookRef.current = currentBook;
        logToResults(`📚 Актуализируем информацию о текущей книге: ${currentBook.author} - ${currentBook.title}`);
      } else {
        logToResults(`❌ Ошибка: текущая книга не найдена при выборе файла.`);
        setProcessingState({ status: 'error', message: 'Ошибка: текущая книга не найдена.' });
        return;
      }
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
                const retryErrorMessage = retryErrorData.error || `HTTP ошибка: ${response.status} ${response.statusText}`;
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
  }, [getAuthToken, processNextBook, setProcessingState, setFileSelectorKey, currentBookRef, isResetting, setIsResetting, currentBookIndex, booksWithoutFiles]);

  // Пропуск книги
  const handleSkipBook = useCallback(async () => {
    // Проверяем флаг сброса
    if (isResetting) {
      logToResults('⏹️ Процесс прерван пользователем (сброс).');
      setIsResetting(false);
      setShowFileSelector(false);
      setFileSelectorKey(prev => prev + 1);
      return;
    }
    
    // Скрываем FileSelector
    setShowFileSelector(false);
    // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
    setFileSelectorKey(prev => prev + 1);
    
    logToResults('⏭️ Пользователь выбрал пропустить книгу');
    
    // Получаем информацию о текущей книге из ref или состояния
    let currentBook = currentBookRef.current;
    if (!currentBook || currentBook.id !== booksWithoutFiles[currentBookIndex]?.id) {
      // Если ref пуст или не соответствует текущей книге, используем книгу из состояния
      if (currentBookIndex < booksWithoutFiles.length) {
        currentBook = booksWithoutFiles[currentBookIndex];
        // Обновляем ref для будущих обращений
        currentBookRef.current = currentBook;
        logToResults(`📚 Актуализируем информацию о текущей книге: ${currentBook.author} - ${currentBook.title}`);
      }
    }
    
    if (currentBook) {
      logToResults(`⏭️ Книга "${currentBook.title}" пропущена пользователем.`);
    } else {
      logToResults('⏭️ Книга пропущена (не найдена).');
    }
    
    // Переходим к следующей книге
    await processNextBook();
  }, [processNextBook, setFileSelectorKey, isResetting, setIsResetting, currentBookIndex, booksWithoutFiles, currentBookRef]);

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
      // Файлы уже сохранены в ref в функции loadTelegramFiles

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
    // Очищаем ref'ы вместо состояний
    currentBookFilesRef.current = [];
    allTelegramFilesRef.current = [];
    currentBookRef.current = null; // Очищаем ref с информацией о текущей книге
    setSelectedFileIndex(0);
    setShowFileSelector(false); // Скрываем FileSelector при сбросе
    setFileSelectorKey(prev => prev + 1); // Увеличиваем ключ для полного перерендеринга FileSelector при следующем открытии
    setIsResetting(true); // Устанавливаем флаг сброса
    logToResults('✅ Состояние сброшено. Логи сохранены.');
  }, [setFileSelectorKey, setIsResetting]);

  return (
    <>
      <div className="flex items-center gap-4">
        <Button
          onClick={startInteractiveFileSearch}
          disabled={processingState.status === 'loading' || processingState.status === 'searching' || processingState.status === 'processing'}
          size="default"
        >
          {processingState.status === 'loading' || processingState.status === 'searching' || processingState.status === 'processing' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              {processingState.status === 'loading' ? 'Загрузка...' : 'Поиск/Обработка...'}
            </>
          ) : (
            <>
              Начать интерактивный поиск
            </>
          )}
        </Button>

        <Button variant="outline" onClick={handleReset} size="default">
          Сброс
        </Button>
      </div>

      {/* Отображаем FileSelector через портал */}
      {showFileSelector && booksWithoutFiles.length > 0 && currentBookIndex < booksWithoutFiles.length && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
            <FileSelector
              key={`file-selector-${fileSelectorKey}-${currentBookIndex}-${booksWithoutFiles[currentBookIndex].id}`}
              book={booksWithoutFiles[currentBookIndex]}
              files={findMatchingFiles(
                booksWithoutFiles[currentBookIndex], 
                allTelegramFilesRef.current.length > 0 ? allTelegramFilesRef.current : []
              )}
              onSelect={handleFileSelect}
              onSkip={handleSkipBook}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
