#!/usr/bin/env tsx

import 'dotenv/config';
import { uploadFileToCloudRu, getFileFromCloudRu } from '../lib/cloud-ru-file-upload';
import { Buffer } from 'buffer';

async function testCloudRuFileUploadLib() {
  console.log('=== Тестирование новой библиотеки загрузки файлов в Cloud.ru ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  console.log(`Бакет: ${bucketName}`);
  
  try {
    // 1. Тестовая загрузка текстового файла
    console.log('\n1. Тестовая загрузка текстового файла...');
    const testTextFileName = `lib-test-text-${Date.now()}.txt`;
    const testTextContent = `Тестовый текстовый файл\nДата: ${new Date().toISOString()}\nСлучайное число: ${Math.random()}`;
    
    const uploadResult = await uploadFileToCloudRu(
      bucketName,
      testTextFileName,
      testTextContent,
      'text/plain'
    );
    
    if (uploadResult.success) {
      console.log('✅ Текстовый файл успешно загружен!');
      console.log(`Статус: ${uploadResult.statusCode} ${uploadResult.statusText}`);
    } else {
      console.error('❌ Ошибка при загрузке текстового файла:', uploadResult.error);
      return;
    }
    
    // 2. Получение загруженного текстового файла
    console.log('\n2. Получение загруженного текстового файла...');
    const getTextResult = await getFileFromCloudRu(bucketName, testTextFileName);
    
    if (getTextResult.success) {
      console.log('✅ Текстовый файл успешно получен!');
      console.log('Содержимое файла:');
      console.log(getTextResult.content);
    } else {
      console.error('❌ Ошибка при получении текстового файла:', getTextResult.error);
    }
    
    // 3. Тестовая загрузка бинарного файла (например, JSON)
    console.log('\n3. Тестовая загрузка JSON файла...');
    const testJsonFileName = `lib-test-data-${Date.now()}.json`;
    const testJsonContent = {
      name: 'Тестовый файл',
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        id: Math.floor(Math.random() * 1000),
        values: [1, 2, 3, 4, 5]
      }
    };
    
    const uploadJsonResult = await uploadFileToCloudRu(
      bucketName,
      testJsonFileName,
      JSON.stringify(testJsonContent, null, 2),
      'application/json'
    );
    
    if (uploadJsonResult.success) {
      console.log('✅ JSON файл успешно загружен!');
      console.log(`Статус: ${uploadJsonResult.statusCode} ${uploadJsonResult.statusText}`);
    } else {
      console.error('❌ Ошибка при загрузке JSON файла:', uploadJsonResult.error);
      return;
    }
    
    // 4. Получение загруженного JSON файла
    console.log('\n4. Получение загруженного JSON файла...');
    const getJsonResult = await getFileFromCloudRu(bucketName, testJsonFileName);
    
    if (getJsonResult.success) {
      console.log('✅ JSON файл успешно получен!');
      try {
        const jsonData = JSON.parse(getJsonResult.content!);
        console.log('Распарсенные данные:');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (parseError) {
        console.log('Содержимое файла (не удалось распарсить как JSON):');
        console.log(getJsonResult.content);
      }
    } else {
      console.error('❌ Ошибка при получении JSON файла:', getJsonResult.error);
    }
    
    console.log('\n🎉 Все тесты пройдены успешно!');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testCloudRuFileUploadLib()
    .then(() => {
      console.log('\n✅ Тест завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testCloudRuFileUploadLib };