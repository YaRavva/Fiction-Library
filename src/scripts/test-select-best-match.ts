import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

// Копируем метод selectBestMatch из file-service.ts
function selectBestMatch(matches: any[], searchTerms: string[], title: string, author: string): any {
    if (matches.length === 0) {
        return null;
    }
    
    if (matches.length === 1) {
        return matches[0];
    }
    
    // Ранжируем совпадения по релевантности
    const rankedMatches = matches.map(book => {
        const bookItem = book as { title: string; author: string };
        let score = 0;
        
        // Проверяем точное совпадение названия (с очень высоким весом)
        if (bookItem.title.toLowerCase() === title.toLowerCase()) {
            score += 50;
        }
        
        // Проверяем точное совпадение автора (с высоким весом)
        if (bookItem.author.toLowerCase() === author.toLowerCase()) {
            score += 30;
        }
        
        // Проверяем совпадение по извлеченному названию (с высоким весом)
        if (bookItem.title.toLowerCase().includes(title.toLowerCase())) {
            score += 20;
        }
        
        // Проверяем совпадение по извлеченному автору (с высоким весом)
        if (bookItem.author.toLowerCase().includes(author.toLowerCase())) {
            score += 20;
        }
        
        // Проверяем, что оба элемента (название и автор) присутствуют
        const titleInBook = bookItem.title.toLowerCase().includes(title.toLowerCase());
        const authorInBook = bookItem.author.toLowerCase().includes(author.toLowerCase());
        
        // Если и название, и автор присутствуют, добавляем бонус
        if (titleInBook && authorInBook) {
            score += 30; // Большой бонус за полное совпадение
        }
        
        // Добавляем проверку на частичное совпадение слов в названии
        // Разбиваем название книги на слова
        const bookTitleWords = bookItem.title.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        const searchTitleWords = title.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        let titleWordsMatchCount = 0;
        
        for (const word of searchTitleWords) {
            if (bookItem.title.toLowerCase().includes(word)) {
                titleWordsMatchCount++;
            }
        }
        
        // Если совпадает более 50% слов из названия, добавляем бонус
        if (searchTitleWords.length > 0 && titleWordsMatchCount / searchTitleWords.length >= 0.5) {
            score += 15;
        }
        
        // Проверяем, чтобы не было ложных совпадений
        // Например, "Мир Перекрёстка" не должен совпадать с "Исчезнувший мир"
        const falsePositiveKeywords = [
            'исчезнувш', 'умирающ', 'смерть', 'оксфордск', 'консул', 'галактическ', 
            'логосов', 'напряжен', 'двуеди', 'морск', 'славянск'
        ];
        
        const titleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
            bookItem.title.toLowerCase().includes(keyword) && !title.toLowerCase().includes(keyword)
        );
        
        const searchTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
            title.toLowerCase().includes(keyword) && !bookItem.title.toLowerCase().includes(keyword)
        );
        
        // Если есть ложные совпадения, уменьшаем счет
        if (titleContainsFalsePositive || searchTitleContainsFalsePositive) {
            score -= 20;
        }
        
        // Проверяем совпадение по поисковым терминам
        for (const term of searchTerms) {
            if (bookItem.title.toLowerCase().includes(term.toLowerCase())) {
                score += 5;
            }
            if (bookItem.author.toLowerCase().includes(term.toLowerCase())) {
                score += 5;
            }
        }
        
        // НОВОЕ: Проверяем включение всех слов из имени файла в название и автора книги
        // Это особенно важно когда автор = "Unknown"
        const allWords = title.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        let allWordsInTitle = true;
        let allWordsInAuthor = true;
        let wordsFoundCount = 0;
        let titleWordsFound = 0;
        let authorWordsFound = 0;
        
        for (const word of allWords) {
            // Проверяем включение слова в название книги
            if (bookItem.title.toLowerCase().includes(word)) {
                wordsFoundCount++;
                titleWordsFound++;
            } else {
                allWordsInTitle = false;
            }
            // Проверяем включение слова в автора книги
            if (bookItem.author.toLowerCase().includes(word)) {
                wordsFoundCount++;
                authorWordsFound++;
            } else {
                allWordsInAuthor = false;
            }
        }
        
        // Если все слова из имени файла включены в название или автора, добавляем бонус
        // Учитываем количество найденных слов
        if (allWordsInTitle || allWordsInAuthor || wordsFoundCount > 0) {
            // Бонус зависит от количества найденных слов
            const wordBonus = Math.min(30, wordsFoundCount * 5); // Максимум 30 баллов
            score += wordBonus;
            
            // Дополнительный бонус, если слова найдены и в названии, и в авторе
            if (titleWordsFound > 0 && authorWordsFound > 0) {
                score += 10; // Дополнительный бонус
            }
        }
        
        // Если все слова включены и в название, и в автора, добавляем еще больший бонус
        if (allWordsInTitle && allWordsInAuthor) {
            score += 20; // Дополнительный бонус
        }
        
        return { book: bookItem, score };
    });
    
    // Сортируем по убыванию релевантности
    rankedMatches.sort((a, b) => (b.score - a.score));
    
    console.log(`  📊 Ранжирование совпадений:`);
    rankedMatches.forEach((match, index) => {
        console.log(`    ${index + 1}. "${match.book.title}" автора ${match.book.author} (счет: ${match.score})`);
    });
    
    // Возвращаем книгу с наивысшей релевантностью, но только если счет достаточно высок
    if (rankedMatches[0].score >= 30) {
        return rankedMatches[0].book;
    }
    
    // Если нет книг с высокой релевантностью, возвращаем null
    console.log(`  ⚠️  Нет книг с достаточной релевантностью (минимум 30)`);
    return null;
}

// Тестовые данные для случая с Мартой Уэллс
const testMatches = [
    {
        id: '1',
        title: 'цикл Дневники Киллербота',
        author: 'Марта Уэллс'
    }
];

const testSearchTerms = ['Марта', 'Уэллс', 'Дневники', 'Киллербота'];
const testTitle = 'Марта_Уэллс_Дневники_Киллербота';
const testAuthor = 'Unknown';

// Основная функция тестирования
async function runSelectBestMatchTest() {
    console.log('🧪 Тестирование метода selectBestMatch из file-service');
    console.log('====================================================');
    
    console.log(`\n🔍 Поиск книги по релевантности...`);
    console.log(`  📚 Найдено ${testMatches.length} потенциальных совпадений по терминам`);
    console.log(`  📚 Найдено ${testMatches.length} уникальных совпадений`);
    console.log(`  🔍 Поисковые термины: ${testSearchTerms.join(', ')}`);
    console.log(`  📊 Извлеченные метаданные из имени файла: author="${testAuthor}", title="${testTitle}"`);
    
    const bestMatch = selectBestMatch(testMatches, testSearchTerms, testTitle, testAuthor);
    
    if (bestMatch) {
        console.log(`  ✅ Выбрана лучшая книга: "${bestMatch.title}" автора ${bestMatch.author}`);
        console.log('\n🎉 Тест пройден успешно!');
        return true;
    } else {
        console.log(`  ⚠️  Подходящая книга не найдена по релевантности.`);
        console.log('\n❌ Тест не пройден.');
        return false;
    }
}

// Запуск теста
if (require.main === module) {
    runSelectBestMatchTest().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Ошибка при выполнении теста:', error);
        process.exit(1);
    });
}

export { runSelectBestMatchTest, selectBestMatch };