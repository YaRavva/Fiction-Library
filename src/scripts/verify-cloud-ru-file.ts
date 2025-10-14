#!/usr/bin/env tsx

import 'dotenv/config';
import { getFileFromCloudRu } from '../lib/cloud-ru-file-upload';

async function verifyCloudRuFile() {
  console.log('=== Проверка наличия файла в Cloud.ru S3 ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  const fileName = '1039.zip';
  
  console.log(`Бакет: ${bucketName}`);
  console.log(`Файл: ${fileName}`);
  
  try {
    console.log('\n1. Попытка получить файл из Cloud.ru S3...');
    const result = await getFileFromCloudRu(bucketName, fileName);
    
    if (result.success) {
      console.log('✅ Файл успешно получен из Cloud.ru S3!');
      console.log(`Размер содержимого: ${result.content?.length} символов`);
      
      // Проверим, что это действительно ZIP файл
      if (result.content) {
        // Преобразуем строку в буфер для проверки заголовка
        const buffer = Buffer.from(result.content, 'utf-8');
        if (buffer.length >= 4) {
          const header = buffer.subarray(0, 4);
          const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
          console.log(`Файл является ZIP архивом: ${isZip ? 'Да' : 'Нет'}`);
        }
      }
    } else {
      console.log('❌ Ошибка при получении файла из Cloud.ru S3:');
      console.log(result.error);
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск проверки
if (require.main === module) {
  verifyCloudRuFile()
    .then(() => {
      console.log('\n✅ Проверка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Проверка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { verifyCloudRuFile };