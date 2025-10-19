import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

async function testReaderLogic() {
  try {
    console.log('🔍 Тестируем логику читалки...');
    
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
          })
        );
      }
    });
    
    await Promise.all(filePromises);
    
    console.log(`📊 Всего загружено файлов: ${fileContents.length}`);
    
    // Имитируем логику читалки
    console.log('\n🔄 Имитация логики читалки:');
    
    let selectedFile: string | null = null;
    let content: string = '';
    let showFileSelector: boolean = false;
    const files = fileContents;
    
    if (files.length === 1) {
      console.log('  Открываем единственный файл');
      selectedFile = files[0].name;
      content = files[0].content;
    } else if (files.length > 1) {
      console.log('  Показываем выбор файлов');
      showFileSelector = true;
    }
    
    console.log(`  selectedFile: ${selectedFile}`);
    console.log(`  content length: ${content.length}`);
    console.log(`  showFileSelector: ${showFileSelector}`);
    console.log(`  files.length: ${files.length}`);
    
    // Проверяем условие отображения селектора файлов (как в интерфейсе)
    const shouldShowFileSelector = showFileSelector && files.length > 1;
    console.log(`\n📋 Условие отображения селектора файлов:`);
    console.log(`  showFileSelector && files.length > 1 = ${shouldShowFileSelector}`);
    
    if (shouldShowFileSelector) {
      console.log(`  📂 Будет показан селектор с ${files.length} файлами:`);
      files.forEach((file, index) => {
        console.log(`    ${index + 1}. ${file.name}`);
      });
    } else if (content.length > 0) {
      console.log(`  📖 Будет открыт файл: ${selectedFile}`);
    } else {
      console.log(`  ⚠️  Ничего не будет показано`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

testReaderLogic();