'use client'

import Link from "next/link"

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Тест стилей</h1>
          <p className="mt-2 text-muted-foreground">
            Если вы видите этот текст с правильными стилями, значит CSS работает
          </p>
        </div>
        
        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Карточка с тестом</h2>
          <p className="mb-4">
            Эта карточка должна иметь:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Фоновый цвет согласно теме</li>
            <li>Цвет текста согласно теме</li>
            <li>Границу с цветом border</li>
            <li>Тень</li>
            <li>Закругленные углы</li>
          </ul>
        </div>
        
        <div className="flex justify-center pt-4">
          <Link 
            href="/" 
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  )
}