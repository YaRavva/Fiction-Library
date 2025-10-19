import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

async function testFileContentDisplay() {
  try {
    console.log('🔍 Тестируем отображение содержимого файла...');
    
    // URL файла в S3
    const fileUrl = 'https://fiction-library-1760461283197.s3.cloud.ru/4379.zip';
    
    console.log(`📥 Загружаем файл: ${fileUrl}`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error(`❌ Ошибка загрузки файла: ${response.status} ${response.statusText}`);
      return;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);
    
    // Берем первый файл для теста
    let firstFileContent: string | null = null;
    const filePromises: Promise<void>[] = [];
    
    zipContent.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
      // Игнорируем директории и служебные файлы macOS (как в читалке)
      if (!zipEntry.dir && 
          (relativePath.endsWith('.fb2') || relativePath.endsWith('.txt')) &&
          !relativePath.includes('__MACOSX/') &&
          !relativePath.includes('/._') &&
          !firstFileContent) {
        filePromises.push(
          zipEntry.async('text').then((content: string) => {
            firstFileContent = content;
            console.log(`  ✅ Загружен файл: ${relativePath} (${content.length} символов)`);
          })
        );
      }
    });
    
    await Promise.all(filePromises);
    
    if (!firstFileContent) {
      console.log('⚠️ Не найдено подходящих файлов');
      return;
    }
    
    // Проверяем, как отображается содержимое в читалке
    console.log('\n📄 Проверка отображения содержимого:');
    
    // В читалке используется dangerouslySetInnerHTML
    // Проверим, есть ли в содержимом потенциальные проблемы
    const content = firstFileContent as string;
    
    console.log(`  Длина содержимого: ${content.length} символов`);
    
    // Проверяем начало содержимого
    const startContent = content.substring(0, 200);
    console.log(`  Начало содержимого:`);
    console.log(`  ${startContent.replace(/\n/g, '\\n').replace(/\t/g, '\\t')}`);
    
    // Проверяем, является ли содержимое корректным XML
    if (content.trim().startsWith('<?xml') || content.trim().startsWith('<FictionBook')) {
      console.log(`  ✅ Содержимое является корректным FB2/XML`);
    } else {
      console.log(`  ❌ Содержимое не является корректным FB2/XML`);
    }
    
    // Проверяем, есть ли закрывающие теги
    if (content.includes('</FictionBook>')) {
      console.log(`  ✅ Найден закрывающий тег </FictionBook>`);
    } else {
      console.log(`  ⚠️  Не найден закрывающий тег </FictionBook>`);
    }
    
    // Проверяем, есть ли потенциально опасные символы
    if (content.includes('<script') || content.includes('javascript:')) {
      console.log(`  ⚠️  Найдены потенциально опасные элементы`);
    }
    
    // Проверяем кодировку
    if (content.includes('encoding="UTF-8"')) {
      console.log(`  ✅ Кодировка UTF-8`);
    } else {
      console.log(`  ⚠️  Не определена кодировка UTF-8`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

testFileContentDisplay();