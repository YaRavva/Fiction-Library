import dotenv from 'dotenv';
dotenv.config();

import { TelegramFileService } from '../lib/telegram/file-service';

// Копируем реализацию приватного метода для тестирования
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

async function testEncodingIssues() {
  console.log('🚀 Тестируем проблемы с кодировкой...\n');
  
  // Тестовые данные с проблемными символами
  const testCases = [
    'Арвендейл.zip',
    'Арвендейл_Тест.zip',
    'Тест_Арвендейл.zip',
    'Арвендейл - Название.zip',
    'Автор_Арвендейл.zip'
  ];
  
  for (const filename of testCases) {
    console.log(`\n📁 Файл: ${filename}`);
    
    // Проверим кодировку строки
    console.log(`  🔤 Длина строки: ${filename.length}`);
    console.log(`  🔢 Коды символов: ${Array.from(filename).map(char => char.charCodeAt(0)).join(', ')}`);
    
    // Проверим, есть ли проблемные символы
    const hasCyrillic = /[а-яА-Я]/.test(filename);
    const hasIChar = filename.includes('й');
    console.log(`  🇷🇺 Содержит кириллицу: ${hasCyrillic}`);
    console.log(`  🅸 Содержит букву "й": ${hasIChar}`);
    
    // Извлекаем метаданные
    const metadata = TelegramFileService.extractMetadataFromFilename(filename);
    console.log(`  📊 Извеченные метаданные: author="${metadata.author}", title="${metadata.title}"`);
    
    // Извлекаем поисковые термины
    const searchTerms = extractSearchTerms(filename);
    console.log(`  🔍 Поисковые термины: [${searchTerms.map((term: string) => `"${term}"`).join(', ')}]`);
  }
  
  console.log('\n✅ Тестирование проблем с кодировкой завершено!');
  
  // Дополнительный тест для проверки нормализации Unicode
  console.log('\n🔍 Тест нормализации Unicode:');
  const testString = 'Арвендейл';
  console.log(`  Исходная строка: "${testString}"`);
  console.log(`  Длина: ${testString.length}`);
  console.log(`  Коды символов: ${Array.from(testString).map(char => {
    const code = char.charCodeAt(0);
    return `${char}(${code})`;
  }).join(', ')}`);
  
  // Проверим нормализованные формы
  const nfc = testString.normalize('NFC');
  const nfd = testString.normalize('NFD');
  const nfkc = testString.normalize('NFKC');
  const nfkd = testString.normalize('NFKD');
  
  console.log(`  NFC: "${nfc}" (длина: ${nfc.length})`);
  console.log(`  NFD: "${nfd}" (длина: ${nfd.length})`);
  console.log(`  NFKC: "${nfkc}" (длина: ${nfkc.length})`);
  console.log(`  NFKD: "${nfkd}" (длина: ${nfkd.length})`);
  
  // Проверим, совпадают ли нормализованные формы
  console.log(`  NFC === исходная: ${nfc === testString}`);
  console.log(`  NFD === исходная: ${nfd === testString}`);
  console.log(`  NFKC === исходная: ${nfkc === testString}`);
  console.log(`  NFKD === исходная: ${nfkd === testString}`);
}

// Запускаем тест
testEncodingIssues().catch(console.error);