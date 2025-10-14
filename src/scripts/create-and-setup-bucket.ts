#!/usr/bin/env tsx

import 'dotenv/config';
import { 
  CreateBucketCommand,
  PutBucketAclCommand,
  PutBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function createAndSetupBucket() {
  console.log('=== Создание и настройка бакета ===');
  
  // Создаем уникальное имя бакета с временной меткой
  const bucketName = `books-${Date.now()}`;
  console.log(`Новый бакет: ${bucketName}`);
  
  try {
    // 1. Создание бакета
    console.log('\n1. Создание бакета...');
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
    });
    
    const createResponse = await cloudRuS3.send(createCommand);
    console.log('✅ Бакет успешно создан');
    console.log('Location:', createResponse.Location);
    
    // 2. Установка ACL бакета
    console.log('\n2. Установка ACL бакета...');
    const putAclCommand = new PutBucketAclCommand({
      Bucket: bucketName,
      ACL: 'private'
    });
    
    await cloudRuS3.send(putAclCommand);
    console.log('✅ ACL бакета успешно установлен');
    
    // 3. Установка политики бакета
    console.log('\n3. Установка политики бакета...');
    
    // Извлекаем tenant ID из AWS_ACCESS_KEY_ID
    const tenantId = process.env.AWS_ACCESS_KEY_ID?.split(':')[0] || 'unknown-tenant';
    
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "OwnerFullAccess",
          Effect: "Allow",
          Principal: {
            AWS: `arn:aws:iam::${tenantId}:root`
          },
          Action: "s3:*",
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        }
      ]
    };
    
    const putPolicyCommand = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy)
    });
    
    await cloudRuS3.send(putPolicyCommand);
    console.log('✅ Политика бакета успешно установлена');
    
    console.log('\n📊 Результаты создания и настройки:');
    console.log(`Новый бакет: ${bucketName}`);
    console.log('ACL: private');
    console.log('Политика: Полный доступ для владельца');
    
    // Обновляем переменную окружения в файле .env
    console.log('\n📝 Обновление файла .env...');
    const fs = require('fs');
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Заменяем значение S3_BUCKET_NAME
    const oldBucketName = process.env.S3_BUCKET_NAME || 'books';
    envContent = envContent.replace(
      new RegExp(`S3_BUCKET_NAME=${oldBucketName}`, 'g'),
      `S3_BUCKET_NAME=${bucketName}`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Файл .env обновлен. Новый бакет: ${bucketName}`);
    
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

// Запуск создания и настройки бакета
if (require.main === module) {
  createAndSetupBucket()
    .then(() => {
      console.log('\n✅ Создание и настройка бакета завершены');
    })
    .catch((error) => {
      console.error('\n❌ Создание и настройка бакета завершены с ошибкой:', error);
      process.exit(1);
    });
}

export { createAndSetupBucket };