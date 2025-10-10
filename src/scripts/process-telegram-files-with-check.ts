/**
 * Скрипт для обработки файлов из Telegram с проверкой наличия в бакете
 * Реализует алгоритм:
 * 1. Если файл уже есть в бакете, то он пропускается
 * 2. Если файла нет в бакете, то осуществляется поиск по алгоритму с релевантностью
 * 3. Если книга найдена с высокой степенью релевантности, то осуществляется загрузка и привязка
 * 4. Если книга не найдена или степень релевантности низкая, то файл пропускается
 */

import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { TelegramSyncService } from '../lib/telegram/sync.js';
import { TelegramFileService } from '../lib/telegram/file-service.js';
import { createClient } from '@supabase/supabase-js';
import { serverSupabase } from '../lib/serverSupabase.js';

/**
 * Конфигурация для разных режимов
 */
interface ProcessConfig {
  limit: number;
  startFromLastId: boolean;
  description: string;
}

/**
 * Получает конфигурацию для указанного режима работы
 */
function getModeConfig(mode: ProcessMode): ProcessConfig {
  switch (mode) {
    case 'full':
      return {
        limit: 1000, // Обрабатываем много файлов в полном режиме
        startFromLastId: false,
        description: 'Полная обработка всех файлов из канала'
      };
    case 'update':
      return {
        limit: 50, // Обрабатываем только новые файлы
        startFromLastId: true,
        description: 'Обработка только новых файлов с последнего обработанного ID'
      };
    case 'auto':
    default:
      return {
        limit: 20, // Автоматический режим - небольшое количество
        startFromLastId: true,
        description: 'Автоматический режим - обработка новых файлов'
      };
  }
}

/**
 * Режимы работы сервиса загрузки файлов
 */
type ProcessMode = 'full' | 'update' | 'auto';

async function processTelegramFilesWithCheck(mode: ProcessMode = 'update') {
  console.log(`🚀 Запускаем обработку файлов из Telegram в режиме: ${mode.toUpperCase()}...`);

  let syncService: TelegramSyncService | null = null;

  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Создаем экземпляр TelegramSyncService
    syncService = await TelegramSyncService.getInstance();

    console.log('✅ Telegram клиент инициализирован');

    // Получаем конфигурацию для выбранного режима
    const config = getModeConfig(mode);
    console.log(`📋 Режим: ${config.description}`);

    // Получаем ID последнего загруженного файла в зависимости от режима
    let lastFileId: number | undefined = undefined;
    if (config.startFromLastId) {
      console.log('🔍 Получаем ID последнего загруженного файла...');

      // Получаем последний обработанный файл из telegram_processed_messages
      const result: { data: any | null; error: any } = await serverSupabase
        .from('telegram_processed_messages')
        .select('telegram_file_id')
        .not('telegram_file_id', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(1)
        .single();

      const { data: lastProcessed, error: lastProcessedError } = result;

      if (lastProcessed && lastProcessed.telegram_file_id) {
        // Если есть последний обработанный файл, начинаем с него
        lastFileId = parseInt(lastProcessed.telegram_file_id, 10);
        console.log(`  📌 Начинаем с файла ID: ${lastFileId}`);
      } else {
        console.log('  🆕 Начинаем с самых новых файлов');
      }
    } else {
      console.log('🔄 Полный режим - начинаем с самых новых файлов');
    }

    // Получаем список файлов из Telegram в соответствии с режимом
    console.log(`📥 Получаем файлы из Telegram (${config.limit} файлов)...`);
    const files = await syncService.downloadAndProcessFilesDirectly(config.limit);
    
    console.log(`\n📊 Найдено файлов: ${files.length}`);
    
    for (const file of files) {
      if (file.success) {
        console.log(`\n📄 Обрабатываем файл: ${file.filename}`);
        console.log(`  Message ID: ${file.messageId}`);
        console.log(`  Размер: ${file.fileSize} байт`);
        
        // Извлекаем метаданные из имени файла
        const { author, title } = TelegramFileService.extractMetadataFromFilename(file.filename as string);
        console.log(`  Автор: ${author}`);
        console.log(`  Название: ${title}`);

        // Демонстрируем нормализацию Unicode
        const filename = file.filename as string;
        console.log(`  🔧 Проверка нормализации Unicode:`);
        console.log(`    Оригинал: "${filename}" (длина: ${filename.length})`);

        const normalized = filename.normalize('NFC');
        console.log(`    NFC форма: "${normalized}" (длина: ${normalized.length})`);

        if (filename !== normalized) {
            console.log(`    ✅ Нормализация изменила строку!`);
        } else {
            console.log(`    ✅ Строка уже в NFC форме`);
        }

        // Формируем имя файла в бакете
        const ext = path.extname(file.filename as string) || '.fb2';
        const storageFileName = `${file.messageId}${ext}`;
        console.log(`  Имя файла в бакете: ${storageFileName}`);
        
        // Проверяем, существует ли файл в бакете
        console.log('  🔍 Проверяем наличие файла в бакете...');
        const { data: fileInfo, error: infoError } = await supabase.storage
          .from('books')
          .list('', {
            search: storageFileName
          });
        
        if (infoError) {
          console.warn(`  ⚠️  Ошибка при проверке файла в бакете: ${infoError.message}`);
          continue;
        }
        
        if (fileInfo && fileInfo.length > 0) {
          console.log(`  ✅ Файл уже существует в бакете, пропускаем`);
          
          // Проверяем, привязан ли файл к книге
          const { data: books, error: booksError } = await supabase
            .from('books')
            .select('id, title, author')
            .eq('storage_path', storageFileName);
          
          if (!booksError && books && books.length > 0) {
            console.log(`  📚 Файл уже привязан к книге: "${books[0].title}" автора ${books[0].author}`);
          } else {
            console.log(`  ⚠️  Файл существует, но не привязан к книге`);
          }
          
          continue;
        }
        
        console.log(`  ❌ Файл не найден в бакете, начинаем обработку`);
        
        // Проверяем наличие книги в базе данных с релевантностью
        console.log('  🔍 Ищем книгу в базе данных с релевантностью...');
        
        // Разбиваем автора и название на слова для поиска
        const titleWords = (title || '').split(/\s+/).filter((word: string) => word.length > 2);
        const authorWords = (author || '').split(/\s+/).filter((word: string) => word.length > 2);
        const allSearchWords = [...titleWords, ...authorWords].filter(word => word.length > 0);
        
        console.log(`    Слова для поиска: [${allSearchWords.join(', ')}]`);
        
        let bookFound = false;
        
        if (allSearchWords.length > 0) {
          // Ищем книги, где в названии или авторе встречаются слова из поискового запроса
          const searchPromises = allSearchWords.map(async (word) => {
            const { data: titleMatches } = await (supabase as any)
              .from('books')
              .select('id, title, author')
              .ilike('title', `%${word}%`)
              .limit(5);
            
            const { data: authorMatches } = await (supabase as any)
              .from('books')
              .select('id, title, author')
              .ilike('author', `%${word}%`)
              .limit(5);
            
            const allMatches = [...(titleMatches || []), ...(authorMatches || [])];
            
            // Удаляем дубликаты по ID
            const uniqueMatches = allMatches.filter((bookItem, index, self) => 
              index === self.findIndex(b => b.id === bookItem.id)
            );
            
            return uniqueMatches;
          });
          
          // Выполняем все поисковые запросы параллельно
          const results = await Promise.all(searchPromises);
          
          // Объединяем все результаты
          const allMatches = results.flat();
          
          // Удаляем дубликаты по ID
          const uniqueMatches = allMatches.filter((bookItem, index, self) => 
            index === self.findIndex(b => b.id === bookItem.id)
          );
          
          // Сортируем по релевантности (по количеству совпадений)
          const matchesWithScores = uniqueMatches.map(bookItem => {
            const bookTitleWords = bookItem.title.normalize('NFC').toLowerCase().split(/\s+/);
            const bookAuthorWords = bookItem.author.normalize('NFC').toLowerCase().split(/\s+/);
            const allBookWords = [...bookTitleWords, ...bookAuthorWords];

            // Считаем количество совпадений поисковых слов с словами в книге
            let score = 0;
            for (const searchWord of allSearchWords) {
              const normalizedSearchWord = searchWord.normalize('NFC').toLowerCase();
              let found = false;
              for (const bookWord of allBookWords) {
                const normalizedBookWord = bookWord.normalize('NFC').toLowerCase();
                // Проверяем точное совпадение или частичное включение
                if (normalizedBookWord.includes(normalizedSearchWord) || normalizedSearchWord.includes(normalizedBookWord)) {
                  score++;
                  found = true;
                  break; // Не увеличиваем счетчик больше одного раза для одного поискового слова
                }
              }
            }
            
            return { ...bookItem, score };
          });
          
          // Сортируем по убыванию счета
          matchesWithScores.sort((a, b) => b.score - a.score);
          
          // Берем только лучшие совпадения и фильтруем по минимальной релевантности
          const topMatches = matchesWithScores.slice(0, 5);
          
          // Возвращаем только совпадения с релевантностью >= 2
          return topMatches.filter(match => match.score >= 2);
          
          if (topMatches.length > 0) {
            console.log(`  ✅ Найдено ${topMatches.length} потенциальных совпадений по релевантности:`);
            topMatches.forEach((match, index) => {
              console.log(`    ${index + 1}. "${match.title}" автора ${match.author} (релевантность: ${match.score})`);
            });
            
            // Выбираем лучшее совпадение (первое в отсортированном списке)
            const bestMatch = topMatches[0];
            console.log(`    Лучшее совпадение: ID=${bestMatch.id}, "${bestMatch.title}" автора ${bestMatch.author} (релевантность: ${bestMatch.score})`);
            
            // Проверяем, что релевантность достаточно высока (минимум 2 совпадения слов)
            if (bestMatch.score >= 2) {
              console.log(`  📎 Привязываем файл к книге...`);
              
              try {
                // Формируем путь к файлу в хранилище
                const storagePath = storageFileName;
                
                // Обновляем запись книги с информацией о файле
                const { data: updatedBook, error: updateError } = await supabase
                  .from('books')
                  .update({
                    storage_path: storagePath,
                    file_size: file.fileSize,
                    file_format: ext.substring(1), // Убираем точку из расширения
                    telegram_file_id: file.messageId
                  })
                  .eq('id', bestMatch.id)
                  .select()
                  .single();
                
                if (updateError) {
                  console.error(`  ❌ Ошибка при обновлении книги: ${updateError?.message || updateError}`);
                } else {
                  console.log(`  ✅ Файл успешно привязан к книге: "${updatedBook.title}" автора ${updatedBook.author}`);
                  bookFound = true;
                }
              } catch (attachError) {
                console.error(`  ❌ Ошибка при привязке файла к книге:`, attachError);
              }
            } else {
              console.log(`  ⚠️  Лучшее совпадение имеет низкую релевантность (${bestMatch.score}), пропускаем`);
            }
          } else {
            console.log(`  ❌ Совпадений не найдено`);
          }
        } else {
          console.log(`  ⚠️  Недостаточно слов для поиска с релевантностью`);
        }
        
        if (!bookFound) {
          console.log(`  🚫 Файл пропущен - книга не найдена или низкая релевантность`);
        }
      } else {
        console.log(`\n❌ Ошибка при обработке файла: ${file.error}`);
      }
    }
    
    // Показываем итоговую статистику
    const processed = files.filter(f => f.success).length;
    const errors = files.filter(f => !f.success).length;
    const attached = files.filter(f => f.success && f.bookId).length;

    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА ОБРАБОТКИ ФАЙЛОВ:');
    console.log('=============================================');
    console.log(`📁 Всего файлов обработано: ${files.length}`);
    console.log(`✅ Успешно обработано: ${processed}`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📎 Привязано к книгам: ${attached}`);
    console.log(`⏭️  Пропущено: ${files.length - processed - errors}`);

    console.log('\n✅ Обработка файлов завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при обработке файлов:', error);
    process.exit(1);
  } finally {
    // Завершаем работу клиента
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram клиент отключен');
      } catch (shutdownError) {
        console.warn('⚠️  Ошибка при отключении Telegram клиента:', shutdownError);
      }
    }
    
    // Принудительное завершение процесса для предотвращения зависания
    console.log('🛑 Принудительное завершение процесса...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Парсим аргументы командной строки
async function main() {
  const args = process.argv.slice(2);
  let mode: ProcessMode = 'update'; // Режим по умолчанию

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const modeValue = arg.split('=')[1] as ProcessMode;
      if (['full', 'update', 'auto'].includes(modeValue)) {
        mode = modeValue;
      }
    }
  }

  console.log(`🚀 Запуск сервиса загрузки файлов в режиме: ${mode.toUpperCase()}`);
  console.log(`🔧 Аргументы командной строки: ${args.join(', ')}`);

  await processTelegramFilesWithCheck(mode);
}

// Запускаем сервис
main().catch((error) => {
  console.error('❌ Необработанная ошибка:', error);
  process.exit(1);
});