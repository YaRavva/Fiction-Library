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

            // Если потенциальное название содержит ключевые слова, характерные для названий
            const titleKeywords = ['цикл', ' saga', ' series', 'оксфордский', 'великий', 'мир', 'война', 'приключения'];
            if (titleKeywords.some(keyword => potentialTitle.toLowerCase().includes(keyword))) {
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

// Тестовые данные
const testFiles = [
    'Марта_Уэллс_Дневники_Киллербота.zip',
    'Ольга_Голотвина_Великий_Грайан_.zip',
    'Джон_Скальци_Люди_в_красном_сборник.fb2'
];

// Основная функция тестирования
async function runExtractMetadataTest() {
    console.log('🧪 Тестирование извлечения метаданных из имен файлов');
    console.log('====================================================');
    
    for (const filename of testFiles) {
        const result = extractMetadataFromFilename(filename);
        console.log(`\nФайл: ${filename}`);
        console.log(`  Автор: "${result.author}"`);
        console.log(`  Название: "${result.title}"`);
    }
}

// Запуск теста
if (require.main === module) {
    runExtractMetadataTest().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Ошибка при выполнении теста:', error);
        process.exit(1);
    });
}

export { runExtractMetadataTest, extractMetadataFromFilename };