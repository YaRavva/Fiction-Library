# Интеграция Shadix UI в Fiction Library

## Обзор

Shadix UI - это кастомный реестр компонентов для shadcn/ui, который предоставляет улучшенные компоненты с современными анимациями на базе Framer Motion. Интеграция позволяет улучшить пользовательский опыт за счет плавных анимаций и более интерактивных элементов.

## Установленные компоненты

### Action Button
Кнопка с встроенным диалогом подтверждения и анимациями загрузки.

**Особенности:**
- Автоматический диалог подтверждения
- Анимации загрузки с спиннером
- Toast уведомления об успехе/ошибке
- Полная совместимость с обычными Button props

**Использование:**
```tsx
import ActionButton from "@/components/ui/action-button";

<ActionButton
  variant="destructive"
  title="Удаление файла"
  popupContent={
    <div>
      <p>Вы уверены, что хотите удалить файл?</p>
      <p className="text-sm text-muted-foreground mt-2">
        Это действие нельзя отменить.
      </p>
    </div>
  }
  onConfirm={async () => {
    // Ваша асинхронная логика
    await deleteFile();
    return { message: "Файл удален", error: false };
  }}
>
  Удалить файл
</ActionButton>
```

### Motion Dialog
Диалог с различными анимациями переходов.

**Доступные анимации:**
- `ripple` - эффект ряби (по умолчанию)
- `slide` - скольжение сверху/снизу
- `flip` - поворот по оси X
- `blur` - размытие с масштабированием
- `elastic` - эластичное появление
- `pulse` - пульсирующий эффект
- `zoom` - масштабирование

**Использование:**
```tsx
import {
  MotionDialog,
  MotionDialogTrigger,
  MotionDialogContent,
  MotionDialogHeader,
  MotionDialogTitle,
  MotionDialogDescription,
  MotionDialogFooter,
  MotionDialogBody,
} from "@/components/ui/motion-dialog";

<MotionDialog animation="ripple">
  <MotionDialogTrigger asChild>
    <Button>Открыть диалог</Button>
  </MotionDialogTrigger>
  <MotionDialogContent>
    <MotionDialogHeader>
      <MotionDialogTitle>Заголовок</MotionDialogTitle>
      <MotionDialogDescription>
        Описание диалога
      </MotionDialogDescription>
    </MotionDialogHeader>
    <MotionDialogBody>
      Содержимое диалога
    </MotionDialogBody>
    <MotionDialogFooter>
      <Button variant="outline">Отмена</Button>
      <Button>Подтвердить</Button>
    </MotionDialogFooter>
  </MotionDialogContent>
</MotionDialog>
```

## Настройка проекта

### 1. Registry конфигурация
В `components.json` добавлен Shadix UI registry:
```json
{
  "registries": {
    "@shadix-ui": "https://shadix-ui.vercel.app/r/{name}.json"
  }
}
```

### 2. Зависимости
Установлены необходимые пакеты:
- `framer-motion` - для анимаций
- `sonner` - для toast уведомлений

### 3. Layout обновления
В `src/app/layout.tsx` добавлен Toaster компонент для уведомлений.

## Примеры интеграции

### BookCard с Action Button
Создана улучшенная версия `BookCardLargeShadix` с использованием Action Button для действий удаления и скачивания:

```tsx
// Кнопка удаления файла с подтверждением
<ActionButton
  size="icon"
  variant="outline"
  className="h-8 w-8 p-0 text-destructive"
  title="Удаление файла книги"
  popupContent={
    <div>
      <p>Вы уверены, что хотите удалить файл для книги <strong>"{book.title}"</strong>?</p>
      <p className="text-sm text-muted-foreground mt-2">
        Это действие удалит привязку файла к книге.
      </p>
    </div>
  }
  onConfirm={handleClearFile}
>
  <X className="h-4 w-4" />
</ActionButton>
```

### Демо-страница
Создана страница `/shadix-demo` для демонстрации всех новых компонентов с интерактивными примерами.

## Миграционная стратегия

### Этап 1: Критические компоненты ✅
- [x] Action Button - установлен и настроен
- [x] Motion Dialog - установлен и настроен
- [x] Toaster - настроен для уведомлений

### Этап 2: Интеграция в существующие компоненты
- [ ] Замена обычных кнопок на Action Button в критических местах
- [ ] Использование Motion Dialog для модальных окон
- [ ] Добавление анимаций hover для карточек

### Этап 3: Расширенные компоненты
- [ ] Установка дополнительных Shadix UI компонентов
- [ ] Создание кастомных анимированных компонентов
- [ ] Оптимизация производительности

## Рекомендации по использованию

### Action Button
- Используйте для действий, требующих подтверждения
- Особенно важно для деструктивных операций (удаление, очистка)
- Всегда возвращайте объект с `message` и `error` из `onConfirm`

### Motion Dialog
- Выбирайте анимацию в зависимости от контекста:
  - `ripple` - универсальная анимация
  - `slide` - для уведомлений и алертов
  - `elastic` - для игривых интерфейсов
  - `blur` - для фокусировки внимания

### Производительность
- Анимации оптимизированы для 60 FPS
- Используйте `will-change` CSS свойство для сложных анимаций
- Тестируйте на мобильных устройствах

## Troubleshooting

### Проблемы с импортами
Если возникают ошибки импорта, проверьте:
1. Правильность путей в `components.json`
2. Установку всех зависимостей
3. Корректность алиасов TypeScript

### Проблемы с анимациями
- Убедитесь, что Framer Motion установлен
- Проверьте, что компонент обернут в клиентский компонент (`"use client"`)
- Для SSR используйте динамический импорт

### Toast уведомления не работают
- Проверьте, что `<Toaster />` добавлен в layout
- Убедитесь, что `sonner` установлен
- Проверьте импорт `toast` из `sonner`

## Дальнейшее развитие

### Планируемые улучшения
1. Добавление анимированных Select и Dropdown компонентов
2. Создание кастомных анимаций для BookCard
3. Интеграция с системой тем проекта
4. Оптимизация bundle size

### Кастомизация
Все компоненты Shadix UI полностью кастомизируемы через:
- CSS переменные для цветов
- Tailwind классы для стилизации
- Framer Motion variants для анимаций

## Заключение

Интеграция Shadix UI значительно улучшает пользовательский опыт Fiction Library за счет современных анимаций и интерактивных элементов. Поэтапный подход обеспечивает плавный переход без нарушения существующей функциональности.