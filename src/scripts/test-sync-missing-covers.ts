import { syncMissingCovers } from './sync-missing-covers';

// Тестируем синхронизацию обложек для 5 книг
syncMissingCovers(5)
  .then(result => {
    console.log('Результат синхронизации обложек:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
  });