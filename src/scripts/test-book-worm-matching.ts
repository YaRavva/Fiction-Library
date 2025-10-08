import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

// Копируем метод findMatchingFile из book-worm-service.ts
function findMatchingFile(book: any, files: any[]): any | null {
    // Проверяем, что у книги есть название и автор
    if (!book.title || !book.author || book.title.trim() === '' || book.author.trim() === '') {
        console.log(`    ⚠️  Книга не имеет названия или автора, пропускаем`);
        return null;
    }
    
    console.log(`    🔍 Поиск файла для книги: "${book.title}" автора ${book.author}`);
    
    // Используем более точный алгоритм поиска
    let bestMatch: any | null = null;
    let bestScore = 0;
    
    for (const file of files) {
        if (!file.filename) continue;
        
        const filename = file.filename.toLowerCase();
        const bookTitle = book.title.toLowerCase();
        const bookAuthor = book.author.toLowerCase();
        
        let score = 0;
        
        // Проверяем точное совпадение названия книги (с высоким весом)
        if (filename.includes(bookTitle.replace(/\s+/g, '_'))) {
            score += 20;
        }
        
        // Проверяем точное совпадение автора (с высоким весом)
        if (filename.includes(bookAuthor.replace(/\s+/g, '_'))) {
            score += 20;
        }
        
        // Проверяем, что оба элемента (название и автор) присутствуют в имени файла
        // Это критически важно для правильного сопоставления
        const titleInFilename = filename.includes(bookTitle.replace(/\s+/g, '_'));
        const authorInFilename = filename.includes(bookAuthor.replace(/\s+/g, '_'));
        
        // Если и название, и автор присутствуют, добавляем бонус
        if (titleInFilename && authorInFilename) {
            score += 30; // Большой бонус за полное совпадение
        }
        
        // Добавляем проверку на частичное совпадение слов в названии
        // Разбиваем название книги на слова
        const bookTitleWords = bookTitle.split(/\s+/).filter((word: string) => word.length > 2);
        let titleWordsMatchCount = 0;
        
        for (const word of bookTitleWords) {
            if (filename.includes(word)) {
                titleWordsMatchCount++;
            }
        }
        
        // Если совпадает более 50% слов из названия, добавляем бонус
        if (bookTitleWords.length > 0 && titleWordsMatchCount / bookTitleWords.length >= 0.5) {
            score += 15;
        }
        
        // Проверяем, чтобы не было ложных совпадений
        // Например, "Мир Перекрёстка" не должен совпадать с "Исчезнувший мир"
        const falsePositiveKeywords = [
            'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
            'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
        ];
        
        const bookTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
            bookTitle.includes(keyword) && !filename.includes(keyword)
        );
        
        const filenameContainsFalsePositive = falsePositiveKeywords.some(keyword => 
            filename.includes(keyword) && !bookTitle.includes(keyword)
        );
        
        // Если есть ложные совпадения, уменьшаем счет
        if (bookTitleContainsFalsePositive || filenameContainsFalsePositive) {
            score -= 20;
        }
        
        // Проверяем частичное совпадение названия (более 80% символов)
        const titleMatchThreshold = Math.floor(bookTitle.length * 0.8);
        if (titleMatchThreshold > 0) {
            const partialTitle = bookTitle.substring(0, Math.min(titleMatchThreshold, bookTitle.length));
            if (filename.includes(partialTitle.replace(/\s+/g, '_'))) {
                score += 10;
            }
        }
        
        // Проверяем частичное совпадение автора (более 80% символов)
        const authorMatchThreshold = Math.floor(bookAuthor.length * 0.8);
        if (authorMatchThreshold > 0) {
            const partialAuthor = bookAuthor.substring(0, Math.min(authorMatchThreshold, bookAuthor.length));
            if (filename.includes(partialAuthor.replace(/\s+/g, '_'))) {
                score += 10;
            }
        }
        
        // Проверяем совпадение по поисковым терминам
        const searchTerms = [...bookTitleWords, ...bookAuthor.split(/\s+/).filter((word: string) => word.length > 2)];
        for (const term of searchTerms) {
            if (filename.includes(term)) {
                score += 5;
            }
        }
        
        // НОВОЕ: Проверяем включение всех слов из имени файла в название и автора книги
        // Разбиваем имя файла на слова
        const filenameWords = filename.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
        let allWordsInTitle = true;
        let allWordsInAuthor = true;
        let wordsFoundCount = 0;
        
        for (const word of filenameWords) {
            // Проверяем включение слова в название книги
            if (bookTitle.includes(word)) {
                wordsFoundCount++;
            } else {
                allWordsInTitle = false;
            }
            // Проверяем включение слова в автора книги
            if (bookAuthor.includes(word)) {
                wordsFoundCount++;
            } else {
                allWordsInAuthor = false;
            }
        }
        
        // Если все слова из имени файла включены в название или автора, добавляем бонус
        // Учитываем количество найденных слов
        if (allWordsInTitle || allWordsInAuthor) {
            // Бонус зависит от количества найденных слов
            const wordBonus = Math.min(30, wordsFoundCount * 5); // Максимум 30 баллов
            score += wordBonus;
        }
        
        // Если все слова включены и в название, и в автора, добавляем еще больший бонус
        if (allWordsInTitle && allWordsInAuthor) {
            score += 20; // Дополнительный бонус
        }
        
        console.log(`      Файл: ${file.filename} (счет: ${score})`);
        
        // Если текущий файл имеет лучший счет, обновляем лучшее совпадение
        // Но только если счет достаточно высок (минимум 30 - это означает, что найдены и название, и автор)
        if (score > bestScore && score >= 30) {
            bestScore = score;
            bestMatch = file;
        }
    }
    
    if (bestMatch && bestScore >= 30) {
        console.log(`    ✅ Найдено совпадение с рейтингом ${bestScore}: ${bestMatch.filename}`);
        return bestMatch;
    }
    
    console.log(`    ⚠️  Совпадения не найдены или совпадение недостаточно точное`);
    return null;
}

// Тестовые данные
const testBooks = [
    {
        id: '1',
        title: 'цикл Дневники Киллербота',
        author: 'Марта Уэллс',
        telegram_post_id: '100'
    },
    {
        id: '2',
        title: 'цикл Великий Грайан',
        author: 'Ольга Голотвина',
        telegram_post_id: '101'
    },
    {
        id: '3',
        title: 'Люди в красном (2012) (2014)',
        author: 'Джон Скальци',
        telegram_post_id: '102'
    }
];

const testFiles = [
    { filename: 'Марта_Уэллс_Дневники_Киллербота.zip', messageId: '3314' },
    { filename: 'Ольга_Голотвина_Великий_Грайан_.zip', messageId: '3481' },
    { filename: 'Джон_Скальци_Люди_в_красном_сборник.fb2', messageId: '3992' }
];

// Основная функция тестирования
async function runBookWormMatchingTest() {
    console.log('🧪 Тестирование алгоритма сопоставления файлов из book-worm-service');
    console.log('==============================================================');
    
    let successCount = 0;
    let totalCount = testBooks.length;
    
    // Тестируем сопоставление для каждой книги
    for (const book of testBooks) {
        console.log(`\n📖 Обработка книги: "${book.title}" автора ${book.author}`);
        const matchingFile = findMatchingFile(book, testFiles);
        
        if (matchingFile) {
            console.log(`  🎯 Тест пройден: найден файл для книги "${book.title}"`);
            successCount++;
        } else {
            console.log(`  ❌ Тест не пройден: не найден файл для книги "${book.title}"`);
        }
    }
    
    console.log('\n📊 Результаты тестирования:');
    console.log(`   Всего тестов: ${totalCount}`);
    console.log(`   Успешно: ${successCount}`);
    console.log(`   Ошибок: ${totalCount - successCount}`);
    console.log(`   Точность: ${Math.round((successCount / totalCount) * 100)}%`);
    
    if (successCount === totalCount) {
        console.log('\n🎉 Все тесты пройдены успешно!');
        return true;
    } else {
        console.log('\n❌ Некоторые тесты не пройдены.');
        return false;
    }
}

// Запуск теста
if (require.main === module) {
    runBookWormMatchingTest().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Ошибка при выполнении теста:', error);
        process.exit(1);
    });
}

export { runBookWormMatchingTest, findMatchingFile };