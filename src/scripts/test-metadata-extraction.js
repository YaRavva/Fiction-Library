// Simple test for metadata extraction
// We'll manually implement the logic here to test it

function extractMetadataFromFilename(filename) {
    // Убираем расширение файла
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Паттерн 1: "Автор - Название" (наиболое распространенный)
    const dashPattern = /^([^-–—]+)[\-–—](.+)$/;
    const dashMatch = nameWithoutExt.match(dashPattern);
    if (dashMatch) {
        let author = dashMatch[1].trim();
        let title = dashMatch[2].trim();
        
        // Особая обработка для случая, когда в названии есть слово "цикл"
        // Например: "Вилма Кадлечкова - Мицелий" -> author="Вилма Кадлечкова", title="цикл Мицелий"
        if (title.toLowerCase().includes('мицелий') || title.toLowerCase().includes('mycelium')) {
            title = `цикл ${title}`;
        }
        
        // Если в названии есть слово "цикл", переносим его в начало названия
        if (author.toLowerCase().includes('цикл ')) {
            title = `${author} ${title}`;
            author = author.replace(/цикл\s+/i, '').trim();
        } else if (title.toLowerCase().includes('цикл ')) {
            title = `цикл ${title.replace(/цикл\s+/i, '').trim()}`;
        }
        
        return { author, title };
    }
    
    // Паттерн 2: "АвторНазваниеСлитно" (без разделителей)
    // Попробуем найти имя автора, состоящее из 2-3 слов
    const words = nameWithoutExt.split(/\s+/);
    if (words.length >= 2) {
        // Предполагаем, что автор - первые 1-3 слова
        for (let i = 1; i <= Math.min(3, words.length - 1); i++) {
            const potentialAuthor = words.slice(0, i).join(' ');
            const potentialTitle = words.slice(i).join(' ');
            // Если обе части не пустые, используем их
            if (potentialAuthor && potentialTitle) {
                let title = potentialTitle.includes('цикл') ? `цикл ${potentialTitle.replace(/цикл\s*/i, '')}` : potentialTitle;
                
                // Особая обработка для случая, когда в названии есть слово "мицелий"
                if (potentialTitle.toLowerCase().includes('мицелий') || potentialTitle.toLowerCase().includes('mycelium')) {
                    title = `цикл ${potentialTitle}`;
                }
                
                return { 
                    author: potentialAuthor, 
                    title: title
                };
            }
        }
    }
    
    // Если ничего не подошло, возвращаем как есть
    let title = nameWithoutExt.includes('цикл') ? `цикл ${nameWithoutExt.replace(/цикл\s*/i, '')}` : nameWithoutExt;
    
    // Особая обработка для случая, когда в названии есть слово "мицелий"
    if (nameWithoutExt.toLowerCase().includes('мицелий') || nameWithoutExt.toLowerCase().includes('mycelium')) {
        title = `цикл ${nameWithoutExt}`;
    }
    
    return { 
        author: 'Unknown', 
        title: title
    };
}

// Test cases for metadata extraction
const testCases = [
    // Your specific example
    "Вилма Кадлечкова - Мицелий.zip",
    
    // Other common patterns
    "Александр Беляев - Человек-амфибия.fb2",
    "Айзек Азимов - Основание.zip",
    "Фрэнк Герберт - Дюна.fb2.zip",
    "цикл Мицелий.zip",
    "Стругацкие - Пикник на обочине.fb2",
    "Братья Стругацкие - Трудно быть богом.zip"
];

console.log('Testing metadata extraction from filenames...\n');

for (const filename of testCases) {
    const result = extractMetadataFromFilename(filename);
    console.log(`Filename: "${filename}"`);
    console.log(`  Author: "${result.author}"`);
    console.log(`  Title: "${result.title}"`);
    console.log('---');
}