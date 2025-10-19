import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

async function testFilePaths() {
  try {
    console.log('🔍 Тестируем обработку путей файлов...');
    
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
    
    console.log('\n📂 Содержимое архива:');
    const fileContents: {name: string, content: string}[] = [];
    const filePromises: Promise<void>[] = [];
    
    zipContent.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
      if (!zipEntry.dir) {
        console.log(`  📄 ${relativePath}`);
      } else {
        console.log(`  📁 ${relativePath}`);
      }
      
      // Игнорируем директории и служебные файлы macOS (как в читалке)
      if (!zipEntry.dir && 
          (relativePath.endsWith('.fb2') || relativePath.endsWith('.txt')) &&
          !relativePath.includes('__MACOSX/') &&
          !relativePath.includes('/._')) {
        filePromises.push(
          zipEntry.async('text').then((content: string) => {
            fileContents.push({ name: relativePath, content });
          })
        );
      }
    });
    
    await Promise.all(filePromises);
    
    console.log(`\n📊 Подходящие файлы для чтения: ${fileContents.length}`);
    
    fileContents.forEach((file, index) => {
      console.log(`\n📄 Файл ${index + 1}:`);
      console.log(`  Путь: ${file.name}`);
      
      // Проверяем, содержит ли путь директорию
      if (file.name.includes('/')) {
        const parts = file.name.split('/');
        console.log(`  Директория: ${parts.slice(0, -1).join('/')}`);
        console.log(`  Имя файла: ${parts[parts.length - 1]}`);
      } else {
        console.log(`  Имя файла: ${file.name}`);
      }
      
      console.log(`  Размер: ${file.content.length} символов`);
    });
    
    // Проверяем, как будут отображаться имена файлов в интерфейсе
    console.log('\n🖥️  Отображение в интерфейсе:');
    fileContents.forEach((file, index) => {
      console.log(`  Кнопка ${index + 1}: "${file.name}"`);
      
      // Проверяем, поместится ли имя в кнопку (примерная проверка)
      if (file.name.length > 50) {
        console.log(`    ⚠️  Имя файла длинное (${file.name.length} символов)`);
        const shortName = file.name.length > 60 ? file.name.substring(0, 57) + '...' : file.name;
        console.log(`    📏 Сокращенное имя: "${shortName}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

testFilePaths();