#!/usr/bin/env tsx

import 'dotenv/config';
import { 
  HeadBucketCommand,
  ListObjectsCommand
} from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function testCoversBucket() {
  console.log('=== Тестирование бакета для обложек ===');
  
  const bucketName = process.env.S3_COVERS_BUCKET_NAME || 'fiction-library-covers';
  console.log(`Бакет: ${bucketName}`);
  
  try {
    // Проверяем существование бакета
    console.log('\n1. Проверка существования бакета...');
    const headCommand = new HeadBucketCommand({
      Bucket: bucketName,
    });
    
    await cloudRuS3.send(headCommand);
    console.log('✅ Бакет существует и доступен');
    
    // Получаем список объектов в бакете
    console.log('\n2. Получение списка объектов в бакете...');
    const listCommand = new ListObjectsCommand({
      Bucket: bucketName,
      MaxKeys: 10, // Ограничиваем до 10 объектов для теста
    });
    
    const response = await cloudRuS3.send(listCommand);
    console.log('✅ Список объектов получен');
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('\n📦 Первые 10 объектов в бакете:');
      response.Contents.slice(0, 10).forEach((obj: any) => {
        console.log(`  - ${obj.Key} (${obj.Size} байт, модифицирован: ${obj.LastModified})`);
      });
      
      if (response.Contents.length > 10) {
        console.log(`  ... и еще ${response.Contents.length - 10} объектов`);
      }
    } else {
      console.log('\n📦 Бакет пуст');
    }
    
    console.log('\n✅ Тест бакета завершен успешно');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message);
    console.error('Код ошибки:', error.name);
    
    // Дополнительная информация об ошибке
    if (error.$metadata) {
      console.error('HTTP Status:', error.$metadata.httpStatusCode);
      console.error('Request ID:', error.$metadata.requestId);
    }
    
    // Выводим стек ошибки для отладки
    console.error('\nПолный стек ошибки:');
    console.error(error);
  }
}

// Запуск теста
if (require.main === module) {
  testCoversBucket()
    .then(() => {
      console.log('\n✅ Тест бакета завершен');
    })
    .catch((error) => {
      console.error('\n❌ Тест бакета завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { testCoversBucket };