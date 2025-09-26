export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Fiction Library
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Электронная библиотека с удобной читалкой FB2 файлов
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">📚</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Большая библиотека
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                До 1000 книг в формате FB2 с автоматической синхронизацией
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Удобная читалка
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Адаптивный дизайн, закладки, заметки и история чтения
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                Умный поиск
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Полнотекстовый поиск, рекомендации и фильтрация по жанрам
              </p>
            </div>
          </div>
          
          <div className="mt-12">
            <a 
              href="/library"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Перейти в библиотеку
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
