# 📋 **ТЕХНИЧЕСКОЕ ЗАДАНИЕ**
## Веб-приложение "Электронная библиотека"

---

## 🎯 **1. ОБЩЕЕ ОПИСАНИЕ ПРОЕКТА**

### **Цель проекта:**
Создание веб-приложения электронной библиотеки с удобной читалкой FB2 файлов и возможностью их скачивания.

### **Целевая аудитория:**
Зарегистрированные пользователи, интересующиеся чтением электронных книг.

---

## 🛠 **2. ТЕХНОЛОГИЧЕСКИЙ СТЕК**

| Компонент | Технология |
|-----------|------------|
| **Frontend** | Next.js (TypeScript/TSX) |
| **Стили** | Tailwind CSS |
| **UI компоненты** | shadcn/ui |
| **Backend** | Supabase |
| **Аутентификация** | Supabase Auth |
| **База данных** | Supabase PostgreSQL |
| **Файловое хранилище** | Supabase Storage |
| **Хостинг** | Vercel |
| **Пакетный менеджер** | pnpm |

---

## ⚙️ **3. ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ**

### **3.1 Система аутентификации**
- ✅ Обязательная регистрация (гостевой доступ запрещен)
- ✅ Роли: Читатели и Администраторы
- ✅ Доступ к контенту только для авторизованных пользователей

### **3.2 Управление книгами**
- ✅ Поддержка формата: **только FB2**
- ✅ Максимальный размер файла: **10 МБ**
- ✅ Общий объем библиотеки: **до 1000 книг**
- ✅ Хранение файлов в Supabase Storage

### **3.3 Поиск и фильтрация**
- ✅ Поиск по автору
- ✅ Поиск по жанру
- ✅ Поиск по году издания
- ✅ Поиск по тегам
- ✅ Категоризация на основе тегов

### **3.4 Читалка FB2**
- ✅ Встроенная читалка для FB2 файлов
- ✅ Закладки
- ✅ Заметки
- ✅ История чтения
- ✅ Избранное

### **3.5 Дополнительные функции**
- ✅ Система рекомендаций
- ✅ Рейтинги книг (1-10, из источника)
- ✅ Пользовательские оценки
- ✅ Возможность скачивания файлов

---

## 🔗 **4. ИНТЕГРАЦИЯ С TELEGRAM**

### **4.1 Источники данных**
- **Канал №1:** Метаданные (описание, обложки, теги, рейтинги)
- **Канал №2:** ZIP-архивы с FB2 файлами

### **4.2 Формат метаданных из первого канала:**
```
Фантастика и фэнтези. Подборки
Автор: Маркус Сэйки
Название: цикл Одаренные
Жанр: #фантастика, #социальная, #приключенческое, #смножественнымгт, #законченсерия
Рейтинг: 7,40 #выше7
Описание: [Подробный текст описания книги/серии]
Состав:
1. Земля Обетованная (2013)
2. Лучший мир (2014)
3. Огненные письмена (2016)
[Изображения обложек книг серии]
```

### **4.3 Структура извлекаемых данных:**
- ✅ **Автор:** из строки "Автор: ..."
- ✅ **Название:** из строки "Название: ..."
- ✅ **Жанры/теги:** парсинг хештегов (#фантастика, #социальная, и т.д.)
- ✅ **Рейтинг:** извлечение числового значения (например, 7,40)
- ✅ **Описание:** полный текст описания
- ✅ **Состав серии:** список книг с годами издания
- ✅ **Обложки:** изображения для каждой книги

### **4.4 Синхронизация**
- ✅ Частота: **ежедневно**
- ✅ Автоматическая обработка новых постов
- ⚠️ **Требует обсуждения:** Использование Telegram Bot API или парсинг

### **4.5 Обработка данных**
- ✅ Парсинг структурированного текста постов
- ✅ Извлечение и сохранение изображений обложек
- ✅ Скачивание и распаковка ZIP-архивов из второго канала
- ✅ Сопоставление метаданных с файлами по названию/автору
- ✅ Автоматическое создание записей в базе данных

---

## 🎨 **5. UI/UX ТРЕБОВАНИЯ**

### **5.1 Дизайн**
- ✅ Минималистичный стиль в духе shadcn/ui
- ✅ Поддержка темной и светлой темы
- ✅ Адаптивный дизайн (равный приоритет мобильных и десктопных устройств)

### **5.2 Локализация**
- ✅ Интерфейс на русском языке
- ✅ Подготовка архитектуры для будущей мультиязычности

---

## 📊 **6. ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ**

### **6.1 Производительность**
- ✅ Максимум **100 одновременных пользователей**
- ✅ Максимум **1000 книг** в библиотеке
- ✅ Размер файла книги: **до 10 МБ**

### **6.2 Хранилище**
- ✅ Общий объем: **до 10 ГБ** (1000 книг × 10 МБ)
- ✅ Supabase Storage для файлов
- ✅ PostgreSQL для метаданных

---

## 🗄️ **7. СТРУКТУРА БАЗЫ ДАННЫХ**

### **7.1 Основные таблицы:**
```sql
-- Пользователи (управляется Supabase Auth)
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'reader', -- 'reader' или 'admin'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Серии книг
series (
  id UUID PRIMARY KEY,
  title VARCHAR(500), -- напр. "цикл Одаренные"
  author VARCHAR(255), -- Маркус Сэйки
  description TEXT,
  rating DECIMAL(3,2), -- 7.40
  cover_url VARCHAR(500),
  telegram_post_id VARCHAR(100), -- для отслеживания обновлений
  tags TEXT[], -- массив тегов
  genres TEXT[], -- фантастика, социальная, и т.д.
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Книги
books (
  id UUID PRIMARY KEY,
  series_id UUID REFERENCES series(id),
  title VARCHAR(500), -- "Земля Обетованная"
  author VARCHAR(255),
  publication_year INTEGER, -- 2013
  description TEXT,
  cover_url VARCHAR(500),
  file_url VARCHAR(500), -- ссылка на Supabase Storage
  file_size BIGINT, -- в байтах
  file_format VARCHAR(10) DEFAULT 'fb2',
  rating DECIMAL(3,2), -- может отличаться от рейтинга серии
  tags TEXT[],
  genres TEXT[],
  series_order INTEGER, -- порядок в серии (1, 2, 3...)
  telegram_file_id VARCHAR(100), -- для связи с Telegram
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Пользовательские данные
user_books (
  user_id UUID REFERENCES users(id),
  book_id UUID REFERENCES books(id),
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, book_id)
)

user_series (
  user_id UUID REFERENCES users(id),
  series_id UUID REFERENCES series(id),
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, series_id)
)

user_bookmarks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  book_id UUID REFERENCES books(id),
  position INTEGER, -- позиция в тексте
  chapter VARCHAR(255), -- название главы
  note TEXT, -- пользовательская заметка
  created_at TIMESTAMP
)

user_ratings (
  user_id UUID REFERENCES users(id),
  book_id UUID REFERENCES books(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  review TEXT, -- опциональный отзыв
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (user_id, book_id)
)

reading_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  book_id UUID REFERENCES books(id),
  last_position INTEGER, -- последняя позиция чтения
  reading_progress DECIMAL(5,2), -- процент прочитанного
  reading_time_minutes INTEGER, -- время чтения в минутах
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Индексы для оптимизации
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_series ON books(series_id);
CREATE INDEX idx_books_genres ON books USING GIN(genres);
CREATE INDEX idx_books_tags ON books USING GIN(tags);
CREATE INDEX idx_series_author ON series(author);
CREATE INDEX idx_series_genres ON series USING GIN(genres);
CREATE INDEX idx_reading_history_user ON reading_history(user_id);
```

---

## 🚀 **8. ЭТАПЫ РАЗРАБОТКИ (РЕКОМЕНДУЕМЫЕ)**

### **MVP (Минимально жизнеспособный продукт):**
1. ✅ Базовая аутентификация
2. ✅ Загрузка и отображение книг
3. ✅ Простая читалка FB2
4. ✅ Базовый поиск

### **Этап 2:**
1. ✅ Закладки и заметки
2. ✅ Система рейтингов
3. ✅ Фильтрация и расширенный поиск

### **Этап 3:**
1. ✅ Интеграция с Telegram
2. ✅ Система рекомендаций
3. ✅ Автоматическая синхронизация

**Статус:** MVP завершён. Переходим к выполнению задач Этапа 2 и подготовке к Этапу 3.

**Текущий фокус (следующие задачи):**
- Улучшить валидацию форм на клиенте (email/password, сообщения об ошибках)
- Добавить toast-уведомления и мелкие анимации (переходы, спиннеры)
- Завершить автоисправления ESLint/TypeScript в оставшихся модулях и типизировать критичные места
- Подготовка архитектуры интеграции с Telegram (подробный план и выбор API)

План действий: реализовать клиентскую валидацию и уведомления → пройтись по критичным ESLint-ошибкам → подготовить модуль интеграции Telegram.

---

## ⚠️ **9. ВОПРОСЫ ДЛЯ УТОЧНЕНИЯ**

### **Критически важно обсудить:**
1. **Telegram API:** Какой подход использовать для интеграции?
   - Telegram Bot API
   - Web-scraping
   - Ручная загрузка с последующей автоматизацией

2. **Администрирование:** Какие права нужны администраторам?
   - Управление пользователями
   - Модерация контента  
   - Ручное добавление книг
   - Управление интеграцией с Telegram

3. **Обработка серий:** Как обрабатывать случаи, когда:
   - В серии добавляются новые книги
   - Изменяются метаданные существующих серий
   - Файлы не соответствуют описанию из первого канала

---

## ✅ **10. КРИТЕРИИ ГОТОВНОСТИ**

### **Функциональные:**
- [ ] Регистрация и аутентификация работают
- [ ] Книги загружаются и отображаются
- [ ] Читалка FB2 функционирует
- [ ] Поиск и фильтрация работают
- [ ] Пользовательские функции (закладки, избранное) реализованы

### **Технические:**
- [ ] Адаптивный дизайн на всех устройствах
- [ ] Темная/светлая тема переключается
- [ ] Производительность соответствует требованиям
- [ ] Безопасность данных обеспечена

---

**Это техническое задание готово для начала разработки. Нужны ли дополнительные уточнения по каким-либо пунктам?**

# Product Requirements Document: File Upload and Attachment Algorithm

## Overview
This document describes the algorithm for uploading and attaching files from Telegram to books in the database.

## File Processing Algorithm

### 1. File Already Exists in Bucket
If a file already exists in the bucket:
- Skip the file processing
- Do not re-upload or re-process

### 2. File Not in Bucket
If a file is not present in the bucket:
1. Extract metadata (author and title) from filename
2. Search for existing book in database using relevance algorithm:
   - Split author and title into words (filter words shorter than 3 characters)
   - Search for books where:
     - Each word from the title is found in the book's title (using ilike)
     - Each word from the author is found in the book's author (using ilike)
   - Require high degree of relevance (both author(s) and title must have significant matches)
3. If a highly relevant book is found:
   - Download file from Telegram
   - Upload file to Supabase Storage bucket
   - Attach file to the existing book record
4. If no book is found or relevance is low:
   - Skip the file
   - Do not create new book records automatically

### 3. Relevance Algorithm Details
The relevance algorithm works as follows:
1. Normalize text (lowercase, remove punctuation)
2. Split author and title into words (filter words shorter than 3 characters)
3. Search database for books where:
   - Each word from the search terms is found in either the book's title or author (using ilike)
4. Calculate relevance score based on the number of matching words between search terms and book metadata
5. Sort results by relevance score in descending order
6. Consider match successful only if relevance score is 2 or higher (at least 2 matching words)
7. Attach file only to the highest scoring match that meets the threshold

### 4. File Naming Convention
Files in the bucket are stored with the following naming convention:
- Format: `MessageID.Extension`
- Example: `4379.zip`

When downloaded by users, files are renamed to:
- Format: `Author - Title.Extension`
- Example: `Вилма Кадлечкова - Мицелий.zip`

## Implementation Notes
- Files must be uploaded directly to the root of the 'books' bucket in Supabase storage
- No nested folders should be created
- Only 'fb2' and 'zip' file formats are permitted
- Book titles must never be modified during parsing or synchronization

## Test Cases
The following test cases demonstrate the algorithm behavior:

1. **Book exists with high relevance**:
   - Search: "Эвернесс" by "Йен Макдональд"
   - Result: Found book "цикл Эвернесс" by "Йен Макдональд"
   - Action: File will be attached to existing book

2. **Book does not exist**:
   - Search: "Мицелий" by "Вилма Кадлечкова"
   - Result: No matching books found
   - Action: File will be skipped

3. **Insufficient search terms**:
   - Search: "A" by "B" (words shorter than 3 characters)
   - Result: Search skipped due to insufficient terms
   - Action: File will be skipped
