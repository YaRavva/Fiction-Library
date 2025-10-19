import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  endpoint: "https://s3.cloud.ru",
  region: process.env.AWS_REGION || 'ru-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const bucketName = process.env.S3_COVERS_BUCKET_NAME!;

async function clearCoversBucket() {
  try {
    console.log(`🚀 Clearing bucket: ${bucketName}`);

    console.log('Listing objects...');
    const listObjectsResponse = await s3Client.send(new ListObjectsV2Command({ Bucket: bucketName }));

    if (!listObjectsResponse.Contents || listObjectsResponse.Contents.length === 0) {
      console.log('✅ Bucket is already empty.');
      return;
    }

    console.log(`Found ${listObjectsResponse.Contents.length} objects to delete.`);

    const deleteParams = {
      Bucket: bucketName,
      Delete: {
        Objects: listObjectsResponse.Contents.map(({ Key }) => ({ Key })),
      },
    };

    console.log('Deleting objects...');
    await s3Client.send(new DeleteObjectsCommand(deleteParams));

    console.log('✅ Bucket cleared successfully.');

  } catch (error) {
    console.error('❌ Error clearing bucket:', error);
  }
}

clearCoversBucket();