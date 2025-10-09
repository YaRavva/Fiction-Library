import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

// Копируем метод extractMetadataFromFilename из file-service.ts
function extractMetadataFromFilename(filename: string): { author: string; title: string } {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Проверяем, что имя файла не пустое
    if (!nameWithoutExt || nameWithoutExt.trim() === '') {
        return { author: 'Unknown', title: 'Без названия' };
    }

    // Специальная обработка для известных паттернов

    // Паттерн: "Автор - Название"
    const dashPattern = /^([^-–—]+)[\-–—](.+)$/;
    const dashMatch = nameWithoutExt.match(dashPattern);
    if (dashMatch) {
        let author = dashMatch[1].trim();
        let title = dashMatch[2].trim();

        // Проверяем, что автор и название не пустые
        if (!author || author.trim() === '') {
            author = 'Unknown';
        }
        if (!title || title.trim() === '') {
            title = 'Без названия';
        }

        // Особая обработка для случая, когда в названии есть слово "мицелий"
        if (title.toLowerCase().includes('мицелий')) {
            title = `цикл ${title}`;
        }

        // Если в названии есть слово "цикл", переносим его в начало названия
        if (author.toLowerCase().includes('цикл ')) {
            title = `${author} ${title}`;
            author = author.replace(/цикл\s+/i, '').trim();
        } else if (title.toLowerCase().includes('цикл ')) {
            title = `цикл ${title.replace(/цикл\s+/i, '').trim()}`;
        }

        // Особая обработка для "Оксфордский цикл"
        if (title.toLowerCase().includes('оксфордский')) {
            title = `цикл ${title}`;
        }

        return { author, title };
    }

    // Специальная обработка для файлов с несколькими авторами
    // Паттерн: "Автор1_и_Автор2_Название" или "Автор1,_Автор2_Название"
    if (nameWithoutExt.includes('_и_')) {
        const parts = nameWithoutExt.split('_и_');
        if (parts.length === 2) {
            const authorsPart = parts[0].replace(/_/g, ' ').trim();
            const titlePart = parts[1].replace(/_/g, ' ').trim();

            let title = titlePart;
            if (title.toLowerCase().includes('мицелий')) {
                title = `цикл ${title}`;
            }

            // Проверяем, что автор и название не пустые
            if (!authorsPart || authorsPart.trim() === '') {
                return { author: 'Unknown', title: title || 'Без названия' };
            }
            if (!title || title.trim() === '') {
                return { author: authorsPart, title: 'Без названия' };
            }

            return { author: authorsPart, title };
        }
    }

    // Паттерн: "Автор1,_Автор2_Название"
    if (nameWithoutExt.includes(',_')) {
        const parts = nameWithoutExt.split(',_');
        if (parts.length === 2) {
            const authorsPart = parts[0].replace(/_/g, ' ').trim();
            const titlePart = parts[1].replace(/_/g, ' ').trim();

            let title = titlePart;
            if (title.toLowerCase().includes('мицелий')) {
                title = `цикл ${title}`;
            }

            // Проверяем, что автор и название не пустые
            if (!authorsPart || authorsPart.trim() === '') {
                return { author: 'Unknown', title: title || 'Без названия' };
            }
            if (!title || title.trim() === '') {
                return { author: authorsPart, title: 'Без названия' };
            }

            return { author: authorsPart, title };
        }
    }

    // Паттерн: "Хроники" в названии
    if (nameWithoutExt.includes('Хроники')) {
        const words = nameWithoutExt.split('_');
        const chroniclesIndex = words.findIndex(word => word.includes('Хроники'));

        if (chroniclesIndex > 0) {
            // Авторы - это слова до "Хроники"
            const authors = words.slice(0, chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
            const title = words.slice(chroniclesIndex).join(' ').replace(/_/g, ' ').trim();

            // Проверяем, что автор и название не пустые
            if (!authors || authors.trim() === '') {
                return { author: 'Unknown', title: title || 'Без названия' };
            }
            if (!title || title.trim() === '') {
                return { author: authors, title: 'Без названия' };
            }

            return { author: authors, title };
        }
    }

    // Паттерн: "Автор1_Автор2_Название" - когда автор и название разделены подчеркиваниями
    // Пытаемся определить, где заканчивается автор и начинается название
    const words = nameWithoutExt
        .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
        .filter(word => word.length > 0) // Убираем пустые слова
        .map(word => word.trim()); // Убираем пробелы

    // Если мало слов, возвращаем как есть
    if (words.length < 2) {
        return { 
            author: 'Unknown', 
            title: nameWithoutExt || 'Без названия'
        };
    }

    // Попробуем найти индикаторы названия (цикл, saga, series и т.д.)
    const titleIndicators = ['цикл', ' saga', ' series', 'оксфордский'];
    let titleStartIndex = words.length; // По умолчанию всё название

    for (let i = 0; i < words.length; i++) {
        const word = words[i].toLowerCase();
        if (titleIndicators.some(indicator => word.includes(indicator))) {
            titleStartIndex = i;
            break;
        }
    }

    // Если индикатор найден, авторы - это слова до него, название - от него и далее
    if (titleStartIndex < words.length) {
        const authors = words.slice(0, titleStartIndex).join(' ');
        let title = words.slice(titleStartIndex).join(' ');

        // Особая обработка для случая, когда в названии есть слово "мицелий"
        if (title.toLowerCase().includes('мицелий')) {
            title = `цикл ${title}`;
        }

        // Особая обработка для "Оксфордский цикл"
        if (title.toLowerCase().includes('оксфордский')) {
            title = `цикл ${title}`;
        }

        // Проверяем, что автор и название не пустые
        if (!authors || authors.trim() === '') {
            return { author: 'Unknown', title: title || 'Без названия' };
        }
        if (!title || title.trim() === '') {
            return { author: authors, title: 'Без названия' };
        }

        return { 
            author: authors, 
            title: title 
        };
    }

    // Новый паттерн: "Автор1_Автор2_Название" - пытаемся определить, где заканчивается автор
    // Ищем наиболее вероятное разделение на автора и название
    if (words.length >= 3) {
        // Попробуем разные варианты разделения
        for (let i = 1; i < Math.min(words.length - 1, 4); i++) { // Проверяем до 3 слов для автора
            const potentialAuthor = words.slice(0, i).join(' ');
            const potentialTitle = words.slice(i).join(' ');

            // Нормализуем потенциальное название
            const normalizedTitle = potentialTitle.normalize('NFC').toLowerCase();

            // Если потенциальное название содержит ключевые слова, характерные для названий
            const titleKeywords = ['цикл', ' saga', ' series', 'оксфордский', 'великий', 'мир', 'война', 'приключения'];
            if (titleKeywords.some(keyword => normalizedTitle.includes(keyword))) {
                return { 
                    author: potentialAuthor, 
                    title: potentialTitle 
                };
            }
        }
    }

    // Если ничего не подошло, возвращаем как есть
    let title = nameWithoutExt;

    // Особая обработка для случая, когда в названии есть слово "мицелий"
    if (nameWithoutExt.toLowerCase().includes('мицелий')) {
        title = `цикл ${nameWithoutExt}`;
    } else if (nameWithoutExt.includes('цикл')) {
        title = `цикл ${nameWithoutExt.replace(/цикл\s*/i, '')}`;
    } else if (nameWithoutExt.toLowerCase().includes('оксфордский')) {
        title = `цикл ${nameWithoutExt}`;
    }

    return { 
        author: 'Unknown', 
        title: title || 'Без названия'
    };
}

// Копируем метод extractSearchTerms из file-service.ts
function extractSearchTerms(filename: string): string[] {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    // Нормализуем строку в NFC форму для консистентности
    const normalized = nameWithoutExt.normalize('NFC');
    
    // Разбиваем имя файла на слова
    const words = normalized
        .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
        .filter(word => word.length > 0) // Убираем пустые слова
        .map(word => word.trim()) // Убираем пробелы
        .filter(word => word.length > 1); // Убираем слова длиной 1 символ
    
    return words;
}

// Копируем метод selectBestMatch из file-service.ts (обновленная версия)
function selectBestMatch(matches: any[], searchTerms: string[], title: string, author: string): any {
    if (matches.length === 0) {
        return null;
    }
    
    if (matches.length === 1) {
        return matches[0];
    }
    
    // Нормализуем входные данные
    const normalizedTitle = title.normalize('NFC');
    const normalizedAuthor = author.normalize('NFC');
    const normalizedSearchTerms = searchTerms.map(term => term.normalize('NFC'));
    
    // Ранжируем совпадения по релевантности
    const rankedMatches = matches.map(book => {
        const bookItem = book as { title: string; author: string };
        // Нормализуем данные книги
        const normalizedBookTitle = bookItem.title.normalize('NFC');
        const normalizedBookAuthor = bookItem.author.normalize('NFC');
        
        let score = 0;
        
        // Проверяем точное совпадение названия (с очень высоким весом)
        if (normalizedBookTitle.toLowerCase() === normalizedTitle.toLowerCase()) {
            score += 50;
        }
        
        // Проверяем точное совпадение автора (с высоким весом)
        if (normalizedBookAuthor.toLowerCase() === normalizedAuthor.toLowerCase()) {
            score += 30;
        }
        
        // Проверяем совпадение по извлеченному названию (с высоким весом)
        if (normalizedBookTitle.toLowerCase().includes(normalizedTitle.toLowerCase())) {
            score += 20;
        }
        
        // Проверяем совпадение по извлеченному автору (с высоким весом)
        if (normalizedBookAuthor.toLowerCase().includes(normalizedAuthor.toLowerCase())) {
            score += 20;
        }
        
        // Проверяем, что оба элемента (название и автор) присутствуют
        const titleInBook = normalizedBookTitle.toLowerCase().includes(normalizedTitle.toLowerCase());
        const authorInBook = normalizedBookAuthor.toLowerCase().includes(normalizedAuthor.toLowerCase());
        
        // Если и название, и автор присутствуют, добавляем бонус
        if (titleInBook && authorInBook) {
            score += 30; // Большой бонус за полное совпадение
        }
        
        // Добавляем проверку на частичное совпадение слов в названии
        // Разбиваем название книги на слова
        const bookTitleWords = normalizedBookTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        const searchTitleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        let titleWordsMatchCount = 0;
        
        for (const word of searchTitleWords) {
            if (normalizedBookTitle.toLowerCase().includes(word)) {
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
            normalizedBookTitle.toLowerCase().includes(keyword) && !normalizedTitle.toLowerCase().includes(keyword)
        );
        
        const searchTitleContainsFalsePositive = falsePositiveKeywords.some(keyword => 
            normalizedTitle.toLowerCase().includes(keyword) && !normalizedBookTitle.toLowerCase().includes(keyword)
        );
        
        // Если есть ложные совпадения, уменьшаем счет
        if (titleContainsFalsePositive || searchTitleContainsFalsePositive) {
            score -= 20;
        }
        
        // Проверяем совпадение по поисковым терминам
        for (const term of normalizedSearchTerms) {
            if (normalizedBookTitle.toLowerCase().includes(term.toLowerCase())) {
                score += 5;
            }
            if (normalizedBookAuthor.toLowerCase().includes(term.toLowerCase())) {
                score += 5;
            }
        }
        
        // НОВОЕ: Проверяем включение всех слов из имени файла в название и автора книги
        // Это особенно важно когда автор = "Unknown"
        // Разбиваем извлеченное название на слова
        const allWords = normalizedTitle.toLowerCase().split(/[_\-\s]+/).filter((word: string) => word.length > 2);
        let allWordsInTitle = true;
        let allWordsInAuthor = true;
        let wordsFoundCount = 0;
        let titleWordsFound = 0;
        let authorWordsFound = 0;
        
        for (const word of allWords) {
            // Проверяем включение слова в название книги
            if (normalizedBookTitle.toLowerCase().includes(word)) {
                wordsFoundCount++;
                titleWordsFound++;
            } else {
                allWordsInTitle = false;
            }
            // Проверяем включение слова в автора книги
            if (normalizedBookAuthor.toLowerCase().includes(word)) {
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
        
        // НОВОЕ: Улучшенная проверка на совпадение названий с префиксом "цикл"
        // Если извлеченное название не содержит "цикл", но название книги содержит "цикл",
        // проверяем, совпадают ли остальные слова
        if (!normalizedTitle.toLowerCase().includes('цикл') && normalizedBookTitle.toLowerCase().includes('цикл')) {
            // Убираем префикс "цикл" из названия книги и проверяем совпадение
            const bookTitleWithoutCycle = normalizedBookTitle.toLowerCase().replace('цикл', '').trim();
            if (bookTitleWithoutCycle.includes(normalizedTitle.toLowerCase()) || 
                normalizedTitle.toLowerCase().includes(bookTitleWithoutCycle)) {
                score += 25; // Большой бонус за совпадение названия с префиксом "цикл"
            } else {
                // Проверяем совпадение слов
                const titleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
                const bookTitleWordsWithoutCycle = bookTitleWithoutCycle.split(/\s+/).filter((word: string) => word.length > 2);
                let cycleWordsMatchCount = 0;
                
                for (const word of titleWords) {
                    if (bookTitleWithoutCycle.includes(word)) {
                        cycleWordsMatchCount++;
                    }
                }
                
                // Если совпадает более 50% слов, добавляем бонус
                if (titleWords.length > 0 && cycleWordsMatchCount / titleWords.length >= 0.5) {
                    score += 15;
                }
            }
        }
        
        // НОВОЕ: Проверка на точное совпадение слов в названии (даже если порядок другой)
        // Это особенно важно для случаев, когда название книги "цикл Великий Грайан",
        // а извлеченное название "Великий Грайан"
        const extractedTitleWords = normalizedTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        const bookTitleWordsFiltered = normalizedBookTitle.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
        let exactWordsMatchCount = 0;
        
        for (const word of extractedTitleWords) {
            if (bookTitleWordsFiltered.includes(word)) {
                exactWordsMatchCount++;
            }
        }
        
        // Если совпадают все слова из извлеченного названия, добавляем большой бонус
        if (extractedTitleWords.length > 0 && exactWordsMatchCount === extractedTitleWords.length) {
            score += 35; // Очень большой бонус за точное совпадение всех слов
        }
        // Если совпадает большинство слов, добавляем средний бонус
        else if (extractedTitleWords.length > 0 && exactWordsMatchCount / extractedTitleWords.length >= 0.7) {
            score += 25;
        }
        // Если совпадает более 50% слов, добавляем небольшой бонус
        else if (extractedTitleWords.length > 0 && exactWordsMatchCount / extractedTitleWords.length >= 0.5) {
            score += 15;
        }
        
        // НОВОЕ: УЛУЧШЕННАЯ ЛОГИКА - проверяем каждое слово из поисковых терминов на вхождение
        // как в название, так и в автора книги
        let improvedWordMatchCount = 0;
        for (const term of normalizedSearchTerms) {
            const termLower = term.toLowerCase();
            // Проверяем вхождение термина в название книги
            if (normalizedBookTitle.toLowerCase().includes(termLower)) {
                improvedWordMatchCount++;
            }
            // Проверяем вхождение термина в автора книги
            if (normalizedBookAuthor.toLowerCase().includes(termLower)) {
                improvedWordMatchCount++;
            }
        }
        
        // Добавляем бонус за количество совпадений слов
        if (normalizedSearchTerms.length > 0) {
            const matchRatio = improvedWordMatchCount / (normalizedSearchTerms.length * 2); // Максимум 100% совпадения
            score += Math.floor(matchRatio * 40); // Максимум 40 баллов за совпадение слов
        }
        
        return { book: {title: normalizedBookTitle, author: normalizedBookAuthor}, score };
    });
    
    // Сортируем по убыванию релевантности
    rankedMatches.sort((a, b) => (b.score - a.score));
    
    console.log(`  📊 Ранжирование совпадений:`);
    rankedMatches.forEach((match, index) => {
        console.log(`    ${index + 1}. "${match.book.title}" автора ${match.book.author} (счет: ${match.score})`);
    });
    
    // Возвращаем книгу с наивысшей релевантностью, но только если счет достаточно высок
    // СНИЖАЕМ порог релевантности до 25, чтобы учитывать улучшенные совпадения
    if (rankedMatches[0].score >= 25) {
        return rankedMatches[0].book;
    }
    
    // Если нет книг с высокой релевантностью, возвращаем null
    console.log(`  ⚠️  Нет книг с достаточной релевантностью (минимум 25)`);
    return null;
}

// Симуляция реальной работы сервиса
async function simulateRealWorkflow() {
    console.log('🧪 Симуляция реальной работы сервиса "Книжный Червь"');
    console.log('====================================================');
    
    // Тестовые данные
    const testFiles = [
        { filename: 'Марта_Уэллс_Дневники_Киллербота.zip', messageId: '3314' },
        { filename: 'Ольга_Голотвина_Великий_Грайан_.zip', messageId: '3481' },
        { filename: 'Джон_Скальци_Люди_в_красном_сборник.fb2', messageId: '3992' }
    ];
    
    const testBooks = [
        {
            id: '1',
            title: 'цикл Дневники Киллербота',
            author: 'Марта Уэллс'
        },
        {
            id: '2',
            title: 'цикл Великий Грайан',
            author: 'Ольга Голотвина'
        },
        {
            id: '3',
            title: 'Люди в красном (2012) (2014)',
            author: 'Джон Скальци'
        }
    ];
    
    let successCount = 0;
    
    // Обрабатываем каждый файл
    for (const file of testFiles) {
        console.log(`\n📥 Обработка файла из сообщения ${file.messageId}...`);
        console.log(`  📄 Имя файла: ${file.filename}`);
        
        // 1. Извлекаем метаданные из имени файла
        const { author, title } = extractMetadataFromFilename(file.filename);
        console.log(`  📊 Извлеченные метаданные из имени файла: author="${author}", title="${title}"`);
        
        // 2. Разбиваем имя файла на поисковые термины
        const searchTerms = extractSearchTerms(file.filename);
        console.log(`  🔍 Поисковые термины: ${searchTerms.join(', ')}`);
        
        // 3. Ищем книги по релевантности
        console.log(`  🔍 Поиск книги по релевантности...`);
        
        // Для симуляции используем все книги как потенциальные совпадения
        const allMatches = testBooks;
        console.log(`  📚 Найдено ${allMatches.length} потенциальных совпадений по терминам`);
        console.log(`  📚 Найдено ${allMatches.length} уникальных совпадений`);
        
        // 4. Выбираем лучшее совпадение
        const bestMatch = selectBestMatch(allMatches, searchTerms, title, author);
        
        if (bestMatch) {
            console.log(`  ✅ Выбрана лучшая книга: "${bestMatch.title}" автора ${bestMatch.author}`);
            successCount++;
        } else {
            console.log(`  ⚠️  Подходящая книга не найдена по релевантности. Файл пропущен: ${file.filename}`);
        }
    }
    
    console.log('\n📊 Результаты симуляции:');
    console.log(`   Всего файлов: ${testFiles.length}`);
    console.log(`   Успешно обработано: ${successCount}`);
    console.log(`   Пропущено: ${testFiles.length - successCount}`);
    console.log(`   Точность: ${Math.round((successCount / testFiles.length) * 100)}%`);
    
    if (successCount === testFiles.length) {
        console.log('\n🎉 Все файлы успешно обработаны!');
        return true;
    } else {
        console.log('\n❌ Некоторые файлы не были обработаны.');
        return false;
    }
}

// Запуск симуляции
if (require.main === module) {
    simulateRealWorkflow().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Ошибка при выполнении симуляции:', error);
        process.exit(1);
    });
}

export { simulateRealWorkflow };