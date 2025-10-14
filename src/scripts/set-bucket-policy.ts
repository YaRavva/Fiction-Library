#!/usr/bin/env tsx

import 'dotenv/config';
import { 
  PutBucketAclCommand,
  PutBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function setBucketPolicy() {
  console.log('=== Установка политики бакета ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  console.log(`Бакет: ${bucketName}`);
  
  try {
    // 1. Установка ACL бакета (полный доступ для владельца)
    console.log('\n1. Установка ACL бакета...');
    const putAclCommand = new PutBucketAclCommand({
      Bucket: bucketName,
      ACL: 'private'
    });
    
    await cloudRuS3.send(putAclCommand);
    console.log('✅ ACL бакета успешно установлен');
    
    // 2. Установка политики бакета (разрешение на все действия для владельца)
    console.log('\n2. Установка политики бакета...');
    
    // Получим Owner ID из переменной окружения или используем заглушку
    const ownerId = process.env.AWS_ACCESS_KEY_ID?.split(':')[0] || 'YOUR-TENANT-ID';
    
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "OwnerFullAccess",
          Effect: "Allow",
          Principal: {
            AWS: `arn:aws:iam::${ownerId}:root`
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
    
    console.log('\n📊 Результаты установки политики:');
    console.log(`Бакет: ${bucketName}`);
    console.log('ACL: private');
    console.log('Политика: Полный доступ для владельца');
    
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

// Запуск установки политики
if (require.main === module) {
  setBucketPolicy()
    .then(() => {
      console.log('\n✅ Установка политики завершена');
    })
    .catch((error) => {
      console.error('\n❌ Установка политики завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { setBucketPolicy };