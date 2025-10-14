import 'dotenv/config';
import { PutBucketAclCommand, GetBucketAclCommand } from '@aws-sdk/client-s3';
import { cloudRuS3 } from '../lib/cloud-ru-s3-service';

async function setBucketAcl() {
  const bucketName = 'books';

  try {
    // First, get the current ACL to understand the owner information
    const getAclCommand = new GetBucketAclCommand({
      Bucket: bucketName,
    });

    console.log('Получение текущего ACL бакета...');
    const getAclResponse = await cloudRuS3.send(getAclCommand);
    console.log('Текущий ACL получен:', JSON.stringify(getAclResponse, null, 2));

    // Extract owner information from the current ACL
    const ownerId = getAclResponse.Owner?.ID;
    const displayName = getAclResponse.Owner?.DisplayName;

    if (!ownerId) {
      throw new Error('Не удалось получить Owner ID из текущего ACL');
    }

    console.log(`Owner ID: ${ownerId}`);
    console.log(`Display Name: ${displayName}`);

    // Define the ACL configuration
    const putAclCommand = new PutBucketAclCommand({
      Bucket: bucketName,
      AccessControlPolicy: {
        Owner: {
          ID: ownerId,
          DisplayName: displayName,
        },
        Grants: [
          {
            Grantee: {
              ID: ownerId,
              DisplayName: displayName,
              Type: 'CanonicalUser',
            },
            Permission: 'FULL_CONTROL',
          },
          {
            Grantee: {
              Type: 'Group',
              URI: 'http://acs.amazonaws.com/groups/global/AllUsers',
            },
            Permission: 'READ',
          },
        ],
      },
    });

    console.log('Установка нового ACL для бакета...');
    const response = await cloudRuS3.send(putAclCommand);
    console.log('ACL успешно установлен:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Ошибка при установке ACL:', error);
    throw error;
 }
}

if (require.main === module) {
  setBucketAcl()
    .then(() => {
      console.log('Скрипт завершен успешно');
    })
    .catch((error) => {
      console.error('Скрипт завершен с ошибкой:', error);
      process.exit(1);
    });
}

export { setBucketAcl };