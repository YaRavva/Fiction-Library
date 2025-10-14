#!/usr/bin/env tsx

import 'dotenv/config';
import { 
  GetBucketAclCommand,
  GetBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function checkBucketOwner() {
  console.log('=== Проверка владельца бакета и политики ===');
  
  const bucketName = process.env.S3_BUCKET_NAME || 'books';
  console.log(`Бакет: ${bucketName}`);
  
  try {
    // 1. Получение ACL бакета (владелец)
    console.log('\n1. Получение ACL бакета...');
    const getAclCommand = new GetBucketAclCommand({
      Bucket: bucketName,
    });
    
    const aclResponse = await cloudRuS3.send(getAclCommand);
    console.log('✅ ACL бакета успешно получен');
    console.log('Owner ID:', aclResponse.Owner?.ID);
    console.log('Owner DisplayName:', aclResponse.Owner?.DisplayName);
    
    // 2. Получение политики бакета
    console.log('\n2. Получение политики бакета...');
    const getPolicyCommand = new GetBucketPolicyCommand({
      Bucket: bucketName,
    });
    
    const policyResponse = await cloudRuS3.send(getPolicyCommand);
    console.log('✅ Политика бакета успешно получена');
    console.log('Policy:', policyResponse.Policy);
    
    // Попробуем распарсить политику
    if (policyResponse.Policy) {
      try {
        const policy = JSON.parse(policyResponse.Policy);
        console.log('Распарсенная политика:');
        console.log(JSON.stringify(policy, null, 2));
      } catch (parseError) {
        console.log('Не удалось распарсить политику:', policyResponse.Policy);
      }
    }
    
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

// Запуск проверки
if (require.main === module) {
  checkBucketOwner()
    .then(() => {
      console.log('\n✅ Проверка завершена');
    })
    .catch((error) => {
      console.error('\n❌ Проверка завершена с ошибкой:', error);
      process.exit(1);
    });
}

export { checkBucketOwner };