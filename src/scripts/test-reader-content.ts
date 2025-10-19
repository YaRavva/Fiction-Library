import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

async function testReaderContent() {
  try {
    console.log('🔍 Тестируем загрузку содержимого книги в читалке...');
    
    // URL файла в S3
    const fileUrl = 'https://fiction-library-1760461283197.s3.cloud.ru/4379.zip';
    const fileFormat = 'zip';
    
    console.log(`📥 Загружаем файл: ${fileUrl}`);
    console.log(`📄 Формат файла: ${fileFormat}`);
    
    if (fileFormat === 'zip') {
      // Для архивов показываем выбор файлов (как в читалке)
      console.log('📦 Обрабатываем как ZIP архив...');
      
      const response = await fetch(fileUrl);
      if (!response.ok) {
        console.error(`❌ Ошибка загрузки файла: ${response.status} ${response.statusText}`);
        return;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      const fileContents: {name: string, content: string}[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
        // Игнорируем директории и служебные файлы macOS (как в читалке)
        if (!zipEntry.dir && 
            (relativePath.endsWith('.fb2') || relativePath.endsWith('.txt')) &&
            !relativePath.includes('__MACOSX/') &&
            !relativePath.includes('/._')) {
          filePromises.push(
            zipEntry.async('text').then((content: string) => {
              fileContents.push({ name: relativePath, content });
              console.log(`  ✅ Загружен файл: ${relativePath} (${content.length} символов)`);
            }).catch((error: any) => {
              console.error(`  ❌ Ошибка загрузки файла ${relativePath}:`, error.message);
            })
          );
        }
      });
      
      await Promise.all(filePromises);
      
      console.log(`📊 Всего загружено файлов: ${fileContents.length}`);
      
      if (fileContents.length === 0) {
        console.log('⚠️ В архиве нет подходящих файлов для чтения');
        return;
      }
      
      if (fileContents.length === 1) {
        console.log('📄 Открываем единственный файл:');
        console.log(`  Название: ${fileContents[0].name}`);
        console.log(`  Размер: ${fileContents[0].content.length} символов`);
        
        // Проверяем, является ли содержимое корректным XML
        const content = fileContents[0].content;
        if (content.trim().startsWith('<?xml') || content.trim().startsWith('<FictionBook')) {
          console.log('✅ Содержимое является корректным FB2 файлом');
          
          // Показываем первые 200 символов
          console.log('📄 Первые 200 символов содержимого:');
          console.log(content.substring(0, 200) + '...');
        } else {
          console.log('❌ Содержимое не является корректным FB2 файлом');
        }
      } else {
        console.log('📋 Найдено несколько файлов:');
        fileContents.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.name}`);
          
          // Проверяем содержимое каждого файла
          const content = file.content;
          if (content.trim().startsWith('<?xml') || content.trim().startsWith('<FictionBook')) {
            console.log(`    ✅ Файл ${index + 1} является корректным FB2 файлом`);
            
            // Показываем первые 100 символов
            console.log(`    📄 Первые 100 символов:`);
            console.log(`    ${content.substring(0, 100).replace(/\n/g, '\\n')}...`);
          } else {
            console.log(`    ❌ Файл ${index + 1} не является корректным FB2 файлом`);
          }
        });
      }
      
    } else {
      // Для одиночных файлов загружаем содержимое (как в читалке)
      console.log('📄 Обрабатываем как одиночный файл...');
      
      const response = await fetch(fileUrl);
      if (!response.ok) {
        console.error(`❌ Ошибка загрузки файла: ${response.status} ${response.statusText}`);
        return;
      }
      
      const text = await response.text();
      console.log(`✅ Файл загружен. Размер: ${text.length} символов`);
      
      // Показываем первые 200 символов
      console.log('📄 Первые 200 символов содержимого:');
      console.log(text.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

testReaderContent();