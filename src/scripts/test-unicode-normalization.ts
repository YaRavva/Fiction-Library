#!/usr/bin/env tsx

/**
 * Тестовый скрипт для проверки нормализации Unicode
 * Проверяет исправления проблемы с кодировкой в сопоставлении имен файлов и книг
 */

async function testUnicodeNormalization() {
    console.log('🧪 Тестирование нормализации Unicode...\n');

    // Тестовые данные с проблемой нормализации
    const testCases = [
        {
            filename: 'Арвендейл_Автор.zip',
            bookTitle: 'Арвендейл',
            bookAuthor: 'Автор'
        },
        {
            filename: 'Арвендейл_Автор.zip', // NFD форма
            bookTitle: 'Арвендейл', // NFC форма
            bookAuthor: 'Автор'
        },
        {
            filename: 'Мицелий_Арвендейл.zip',
            bookTitle: 'Арвендейл',
            bookAuthor: 'Автор'
        }
    ];

    console.log('📋 Тестовые случаи:');
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. Файл: "${testCase.filename}"`);
        console.log(`   Книга: "${testCase.bookTitle}" автора ${testCase.bookAuthor}`);
        console.log(`   Длина filename: ${testCase.filename.length}`);
        console.log(`   Длина bookTitle: ${testCase.bookTitle.length}`);
        console.log('');
    });

    // Тестируем нормализацию
    console.log('🔧 Тестирование нормализации:');
    testCases.forEach((testCase, index) => {
        const normalizedFilename = testCase.filename.normalize('NFC');
        const normalizedTitle = testCase.bookTitle.normalize('NFC');

        console.log(`${index + 1}. После нормализации:`);
        console.log(`   filename: "${normalizedFilename}" (длина: ${normalizedFilename.length})`);
        console.log(`   title: "${normalizedTitle}" (длина: ${normalizedTitle.length})`);

        // Тестируем сравнение
        const filenameLower = normalizedFilename.toLowerCase();
        const titleLower = normalizedTitle.toLowerCase();

        console.log(`   Сравнение после нормализации:`);
        console.log(`   filename.includes(title): ${filenameLower.includes(titleLower.replace(/\s+/g, '_'))}`);

        console.log('');
    });

    // Тестируем алгоритм сопоставления файлов
    console.log('🎯 Тестирование алгоритма сопоставления файлов:');

    for (const testCase of testCases) {
        console.log(`Тест: "${testCase.filename}" -> "${testCase.bookTitle}"`);

        // Симулируем алгоритм из findMatchingFile
        const filename = testCase.filename.normalize('NFC').toLowerCase();
        const bookTitle = testCase.bookTitle.normalize('NFC').toLowerCase();
        const bookAuthor = testCase.bookAuthor.normalize('NFC').toLowerCase();

        let score = 0;

        // Проверяем точное совпадение названия книги (с высоким весом)
        if (filename.includes(bookTitle.replace(/\s+/g, '_'))) {
            score += 20;
        }

        // Проверяем точное совпадение автора (с высоким весом)
        if (filename.includes(bookAuthor.replace(/\s+/g, '_'))) {
            score += 20;
        }

        // Проверяем частичное совпадение слов
        const bookTitleWords = bookTitle.split(/\s+/).filter(word => word.length > 2);
        for (const word of bookTitleWords) {
            if (filename.includes(word)) {
                score += 5;
            }
        }

        console.log(`   Счет совпадения: ${score}`);
        console.log(`   Результат: ${score >= 25 ? '✅ Найдено' : '❌ Не найдено'}`);
        console.log('');
    }

    // Тестируем извлечение метаданных из имени файла (как в file-service.ts)
    console.log('📝 Тестирование извлечения метаданных из имени файла:');

    const testFilenames = [
        'Арвендейл_Автор.zip',
        'Арвендейл_Автор.zip',
        'Мицелий_Арвендейл.zip',
        'Цикл_Арвендейл_Автор.zip'
    ];

    for (const filename of testFilenames) {
        console.log(`Файл: "${filename}"`);

        // Симулируем extractMetadataFromFilename
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "").normalize('NFC');

        // Паттерн: "Автор - Название"
        const dashPattern = /^([^-–—]+)[\-–—](.+)$/;
        const dashMatch = nameWithoutExt.match(dashPattern);

        if (dashMatch) {
            let author = dashMatch[1].trim();
            let title = dashMatch[2].trim();

            // Особая обработка для мицелия
            if (title.normalize('NFC').toLowerCase().includes('мицелий')) {
                title = `цикл ${title}`;
            }

            // Особая обработка для цикла
            if (author.normalize('NFC').toLowerCase().includes('цикл ')) {
                title = `${author} ${title}`;
                author = author.replace(/цикл\s+/i, '').trim();
            } else if (title.normalize('NFC').toLowerCase().includes('цикл ')) {
                title = `цикл ${title.replace(/цикл\s+/i, '').trim()}`;
            }

            console.log(`   Извлечено: автор="${author}", название="${title}"`);
        } else {
            console.log(`   Не удалось извлечь метаданные`);
        }
        console.log('');
    }

    console.log('✅ Тестирование нормализации Unicode завершено!');
}

// Запускаем тест
testUnicodeNormalization().catch((error) => {
    console.error('❌ Ошибка при тестировании:', error);
    process.exit(1);
});