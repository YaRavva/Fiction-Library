import 'dotenv/config';
import { GetBucketAclCommand } from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function getBucketAcl() {
  try {
    const command = new GetBucketAclCommand({
      Bucket: 'books',
    });

    const response = await cloudRuS3.send(command);
    
    console.log('ACL для бакета "books":', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Ошибка при получении ACL бакета:', error);
    throw error;
  }
}

getBucketAcl().catch(console.error);