import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-red-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <div className="mb-6">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Доступ запрещен
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              У вас нет прав для доступа к этому разделу. Обратитесь к администратору для получения необходимых разрешений.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/library"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Вернуться в библиотеку
            </Link>
            
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную страницу
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}