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
import { createClient } from '@supabase/supabase-js';

async function processTelegramFilesWithCheck() {
  console.log('🚀 Запускаем обработку файлов из Telegram с проверкой наличия...\n');

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
    
    // Получаем список файлов из Telegram (ограничиваем до 5 для теста)
    console.log('📥 Получаем список файлов из Telegram...');
    const files = await syncService.downloadAndProcessFilesDirectly(5);
    
    console.log(`\n📊 Найдено файлов: ${files.length}`);
    
    for (const file of files) {
      if (file.success) {
        console.log(`\n📄 Обрабатываем файл: ${file.filename}`);
        console.log(`  Message ID: ${file.messageId}`);
        console.log(`  Размер: ${file.fileSize} байт`);
        
        // Извлекаем метаданные из имени файла
        const { author, title } = TelegramSyncService.extractMetadataFromFilename(file.filename);
        console.log(`  Автор: ${author}`);
        console.log(`  Название: ${title}`);
        
        // Формируем имя файла в бакете
        const ext = path.extname(file.filename) || '.fb2';
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
        const titleWords = (title || '').split(/\s+/).filter(word => word.length > 2);
        const authorWords = (author || '').split(/\s+/).filter(word => word.length > 2);
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
            const bookTitleWords = bookItem.title.toLowerCase().split(/\s+/);
            const bookAuthorWords = bookItem.author.toLowerCase().split(/\s+/);
            const allBookWords = [...bookTitleWords, ...bookAuthorWords];
            
            // Считаем количество совпадений поисковых слов с словами в книге
            let score = 0;
            for (const searchWord of allSearchWords) {
              const normalizedSearchWord = searchWord.toLowerCase();
              let found = false;
              for (const bookWord of allBookWords) {
                const normalizedBookWord = bookWord.toLowerCase();
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

// Запускаем скрипт
processTelegramFilesWithCheck();