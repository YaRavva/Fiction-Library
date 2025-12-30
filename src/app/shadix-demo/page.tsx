"use client";

import { useState, useEffect } from "react";
import ActionButton from "@/components/ui/action-button";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookCardLargeShadix } from "@/components/books/book-card-large-shadix";
import { PageTransition } from "@/components/ui/page-transition";

// Мок данные для демонстрации
const mockBook = {
  id: "demo-book-1",
  title: "Пример книги с Shadix UI",
  author: "Демо Автор",
  description: "Это пример книги для демонстрации новых анимированных компонентов Shadix UI. Обратите внимание на плавные анимации кнопок и улучшенные hover эффекты.",
  genres: ["фантастика", "приключения"],
  rating: 4.5,
  file_url: "https://example.com/book.fb2",
  cover_url: "https://via.placeholder.com/300x400/4f46e5/ffffff?text=Demo+Book",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  file_size: 1024000,
  file_format: "fb2",
  telegram_file_id: undefined,
  telegram_message_id: undefined,
  series_id: undefined,
  series_number: null,
  year: 2024,
  language: "ru",
  isbn: null,
  publisher: null,
  pages: null,
  annotation: null,
  tags: [],
  downloads_count: 0,
  views_count: 0
};

export default function ShadixDemoPage() {
  const [selectedAnimation, setSelectedAnimation] = useState<"ripple" | "slide" | "flip" | "blur" | "elastic" | "pulse" | "zoom">("ripple");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Shadix UI Demo</h1>
          <p className="text-muted-foreground text-lg">
            Загрузка демонстрации...
          </p>
        </div>
      </div>
    );
  }

  const handleActionButtonConfirm = async () => {
    // Симуляция асинхронной операции
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Случайный результат для демонстрации
    const success = Math.random() > 0.3;
    
    return {
      message: success ? "Операция выполнена успешно!" : "Произошла ошибка",
      error: !success
    };
  };

  const animations = [
    { value: "ripple", label: "Ripple" },
    { value: "slide", label: "Slide" },
    { value: "flip", label: "Flip" },
    { value: "blur", label: "Blur" },
    { value: "elastic", label: "Elastic" },
    { value: "pulse", label: "Pulse" },
    { value: "zoom", label: "Zoom" },
  ] as const;

  return (
    <PageTransition>
      <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Shadix UI Demo</h1>
        <p className="text-muted-foreground text-lg">
          Демонстрация новых анимированных компонентов
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Action Button Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Action Button</CardTitle>
            <CardDescription>
              Кнопка с подтверждением и анимациями загрузки
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <ActionButton
                variant="default"
                title="Подтверждение действия"
                popupContent={
                  <div>
                    <p>Вы уверены, что хотите выполнить это действие?</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Это действие может занять некоторое время.
                    </p>
                  </div>
                }
                onConfirm={handleActionButtonConfirm}
              >
                Выполнить действие
              </ActionButton>
            </div>
            
            <div className="space-y-2">
              <ActionButton
                variant="destructive"
                title="Удаление элемента"
                popupContent={
                  <div>
                    <p>Вы уверены, что хотите удалить этот элемент?</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Это действие нельзя отменить.
                    </p>
                  </div>
                }
                onConfirm={async () => {
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  return { message: "Элемент удален", error: false };
                }}
              >
                Удалить элемент
              </ActionButton>
            </div>
          </CardContent>
        </Card>

        {/* Motion Dialog Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Motion Dialog</CardTitle>
            <CardDescription>
              Диалог с различными анимациями переходов
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Выберите анимацию:</label>
              <div className="grid grid-cols-2 gap-2">
                {animations.map((animation) => (
                  <Button
                    key={animation.value}
                    variant={selectedAnimation === animation.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedAnimation(animation.value)}
                  >
                    {animation.label}
                  </Button>
                ))}
              </div>
            </div>

            <MotionDialog animation={selectedAnimation}>
              <MotionDialogTrigger asChild>
                <Button className="w-full">
                  Открыть диалог ({selectedAnimation})
                </Button>
              </MotionDialogTrigger>
              <MotionDialogContent>
                <MotionDialogHeader>
                  <MotionDialogTitle>
                    Анимированный диалог
                  </MotionDialogTitle>
                  <MotionDialogDescription>
                    Этот диалог использует анимацию "{selectedAnimation}"
                  </MotionDialogDescription>
                </MotionDialogHeader>
                <MotionDialogBody>
                  <p>
                    Содержимое диалога с плавными анимациями переходов.
                    Попробуйте разные варианты анимаций, чтобы увидеть различия.
                  </p>
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      <strong>Текущая анимация:</strong> {selectedAnimation}
                    </p>
                  </div>
                </MotionDialogBody>
                <MotionDialogFooter>
                  <Button variant="outline">Отмена</Button>
                  <Button>Подтвердить</Button>
                </MotionDialogFooter>
              </MotionDialogContent>
            </MotionDialog>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Section */}
      <Card>
        <CardHeader>
          <CardTitle>Сравнение с обычными компонентами</CardTitle>
          <CardDescription>
            Сравните новые анимированные компоненты с обычными
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="font-semibold">Обычные компоненты</h3>
              <Button variant="default">Обычная кнопка</Button>
              <Button variant="destructive">Обычная кнопка удаления</Button>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Shadix UI компоненты</h3>
              <ActionButton
                title="Подтверждение"
                popupContent={<p>Подтвердите действие</p>}
                onConfirm={async () => ({ message: "Готово!", error: false })}
              >
                Action Button
              </ActionButton>
              <ActionButton
                variant="destructive"
                title="Удаление"
                popupContent={<p>Подтвердите удаление</p>}
                onConfirm={async () => ({ message: "Удалено!", error: false })}
              >
                Action Button (удаление)
              </ActionButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BookCard Example */}
      <Card>
        <CardHeader>
          <CardTitle>Пример интеграции в BookCard</CardTitle>
          <CardDescription>
            Демонстрация использования Action Button в реальном компоненте
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookCardLargeShadix
            book={mockBook}
            onDownload={(book) => console.log('Download:', book.title)}
            onRead={(book) => console.log('Read:', book.title)}
            onTagClick={(tag) => console.log('Tag clicked:', tag)}
            userProfile={{ id: "demo-user", role: "admin" }}
            onFileClear={(bookId) => console.log('File cleared:', bookId)}
          />
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
}