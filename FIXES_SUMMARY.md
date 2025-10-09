# Исправления для проблемы импорта книг "цикл Луна" и "цикл Одаренные"

## Проблемы, которые были выявлены:

1. **Неправильная обработка обложек из альбомов Telegram** - не все типы медиа в альбомах корректно обрабатывались
2. **Отсутствующие столбцы в базе данных** - таблица series не имела столбцов series_composition и cover_urls
3. **Недостаточная обработка ошибок** - ошибки создания серий не добавлялись в результаты синхронизации

## Внесенные изменения:

### 1. Исправлен обработчик синхронизации (src/lib/telegram/sync.ts)
- Улучшена обработка различных типов медиа в альбомах Telegram
- Добавлена правильная проверка типов для функции downloadMedia
- Улучшена обработка ошибок при загрузке обложек

### 2. Исправлен парсер (src/lib/telegram/parser.ts)
- Улучшен метод extractBooks для более надежного извлечения состава серии

### 3. Исправлен обработчик синхронизации (src/app/api/admin/sync/route.ts)
- Добавлена правильная обработка ошибок при создании серий
- Ошибки создания серий теперь добавляются в результаты синхронизации

### 4. Добавлены миграции базы данных:
- `008_fix_series_schema.sql` - добавляет недостающие столбцы в таблицу series
- `009_fix_books_series.sql` - обеспечивает правильную связь между книгами и сериями
- `010_add_series_indexes.sql` - добавляет индексы для улучшения производительности

## SQL скрипты для выполнения:

### Миграция 008: Исправление схемы таблицы series
```
-- Add series_composition column to store books composition
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS series_composition JSONB DEFAULT '[]';

-- Add cover_urls column to store all cover images for the series
ALTER TABLE series 
ADD COLUMN IF NOT EXISTS cover_urls TEXT[] DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_series_composition ON series USING GIN(series_composition);
CREATE INDEX IF NOT EXISTS idx_series_cover_urls ON series USING GIN(cover_urls);

-- Update the existing series records to ensure they have the correct structure
UPDATE series 
SET series_composition = '[]'::jsonb 
WHERE series_composition IS NULL;

UPDATE series 
SET cover_urls = '{}'::text[] 
WHERE cover_urls IS NULL;
```

### Миграция 009: Исправление связи книг и серий
```
-- Make sure series_id column exists and has proper constraints
ALTER TABLE books 
ALTER COLUMN series_id TYPE UUID USING series_id::UUID;

-- Add index for better performance on series_id
CREATE INDEX IF NOT EXISTS idx_books_series_id ON books(series_id);

-- Update any books that might have incorrect series associations
-- This will clear any invalid series_id references
UPDATE books 
SET series_id = NULL 
WHERE series_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM series WHERE series.id = books.series_id
);
```

### Миграция 010: Добавление индексов для производительности
```sql
-- Index for series title and author for faster lookups
CREATE INDEX IF NOT EXISTS idx_series_title_author ON series(title, author);

-- Index for books title and author for faster lookups
CREATE INDEX IF NOT EXISTS idx_books_title_author ON books(title, author);

-- Index for books publication year for sorting
CREATE INDEX IF NOT EXISTS idx_books_publication_year_desc ON books(publication_year DESC);

-- Index for series rating for sorting
CREATE INDEX IF NOT EXISTS idx_series_rating_desc ON series(rating DESC NULLS LAST);

-- Index for books rating for sorting
CREATE INDEX IF NOT EXISTS idx_books_rating_desc ON books(rating DESC NULLS LAST);

-- Index for series created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_series_created_at_desc ON series(created_at DESC);

-- Index for books created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_books_created_at_desc ON books(created_at DESC);
```

## Проверка исправлений:

Для проверки исправлений были созданы тестовые скрипты:
- `src/scripts/test-parser.ts` - тест для серии "Луна"
- `src/scripts/test-parser-odarennue.ts` - тест для серии "Одаренные"

Оба теста теперь проходят успешно, что подтверждает корректную работу парсера.

## Рекомендации:

1. Выполните все три SQL миграции в указанном порядке
2. Перезапустите процесс синхронизации
3. Проверьте, что серии "цикл Луна" и "цикл Одаренные" теперь корректно импортируются с составом и обложками

# Исправления в логике привязки файлов к книгам

## Проблема 1: Неправильное сопоставление файлов и книг
Ранее при обработке файлов с именами типа "Ольга_Голотвина_Великий_Грайан_.zip" система не могла правильно определить соответствующую книгу "цикл Великий Грайан" автора Ольга Голотвина. Алгоритм выдавал ошибку:
```
⚠️  Нет книг с достаточной релевантностью (минимум 30)
⚠️  Подходящая книга не найдена по релевантности. Файл пропущен: Ольга_Голотвина_Великий_Грайан_.zip
```

### Причина
Проблема была в методе `selectBestMatch` в файле `src/lib/telegram/file-service.ts`, который:
1. Неправильно рассчитывал релевантность совпадений
2. Не учитывал, что каждое слово из имени файла должно проверяться на вхождение как в автора, так и в название книги
3. Имел слишком высокий порог релевантности (30), который не достигался для корректных совпадений

### Решение
Внесены изменения в метод `selectBestMatch`:

1. **Улучшена логика проверки совпадений слов**:
   - Каждое слово из поисковых терминов теперь проверяется на вхождение как в название, так и в автора книги
   - Добавлены бонусы за точное совпадение слов, даже если порядок другой

2. **Улучшена работа с префиксом "цикл"**:
   - Добавлена специальная логика для обработки названий книг с префиксом "цикл"
   - Улучшена проверка совпадений слов в названиях с префиксом "цикл"

3. **Снижен порог релевантности**:
   - Порог релевантности снижен с 30 до 25 для учета улучшенных совпадений

4. **Добавлены дополнительные бонусы**:
   - Бонусы за количество совпадений слов (максимум 40 баллов)
   - Бонусы за точное совпадение всех слов из названия (максимум 35 баллов)

## Проблема 2: Проблемы с кодировкой (буква "й")
В именах файлов, содержащих букву "й", возникали странные артефакты отображения как в Telegram, так и в окне "Результаты последней операции". Это было связано с тем, что в Unicode буква "й" может представляться в двух формах:
- NFC: Одна буква "й" (код 1081)
- NFD: Две буквы "и" (1080) + комбинирующийся знак (774)

Когда имена файлов приходили в одной форме, а в базе данных хранились в другой, происходило неправильное сопоставление.

### Решение
Внесены изменения в следующие методы файла `src/lib/telegram/file-service.ts`:

1. **Метод `extractMetadataFromFilename`**:
   - Добавлена нормализация входных данных в NFC форму

2. **Метод `extractSearchTerms`**:
   - Добавлена нормализация строк в NFC форму для консистентности

3. **Метод `selectBestMatch`**:
   - Добавлена нормализация всех входных данных и данных из базы в NFC форму
   - Все сравнения теперь производятся с нормализованными строками

## Результаты
После внесенных изменений:
- Файл "Ольга_Голотвина_Великий_Грайан_.zip" теперь правильно привязывается к книге "цикл Великий Грайан" автора Ольга Голотвина со счетом 140 (ранее было 20)
- Файл "Вилма_Кадлечкова_Мицелий.zip" теперь правильно привязывается к книге "цикл Мицелий" автора Вилма Кадлечкова со счетом 95
- Файлы с буквой "й" в различных Unicode формах теперь корректно сопоставляются с книгами в базе данных

## Тестирование
Созданы тестовые скрипты:
- `src/scripts/test-improved-matching.ts` - общий тест улучшенной логики
- `src/scripts/test-problematic-case.ts` - тест конкретного проблемного случая
- `src/scripts/test-encoding-issues.ts` - тест проблем с кодировкой
- `src/scripts/test-unicode-normalization.ts` - тест нормализации Unicode
- `src/scripts/test-real-encoding-issue.ts` - тест реальной проблемы с кодировкой
- `src/scripts/test-fixed-encoding.ts` - тест исправленной логики работы с кодировкой

## Важно
Исправления касаются только логики определения соответствия файла книге. Фактически, для привязки файла совершенно не важно, является ли книга частью серии/цикла или одиночной книгой, поскольку и в том, и в другом случае будет один файл (все содержимое внутри архива).
