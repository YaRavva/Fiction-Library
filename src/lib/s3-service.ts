import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

// Create S3 client instance
const createS3Client = () => new S3Client({
  endpoint: "https://s3.cloud.ru",
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

export const getObject = async (key: string) => {
  const s3Client = createS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  });
  return s3Client.send(command);
};

export const putObject = async (key: string, body: Buffer) => {
  const s3Client = createS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: body
  });
  return s3Client.send(command);
};