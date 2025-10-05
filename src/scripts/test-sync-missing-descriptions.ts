import { syncMissingDescriptions } from './sync-missing-descriptions';

// Тестируем синхронизацию описаний для 5 книг
syncMissingDescriptions(5)
  .then(result => {
    console.log('Результат синхронизации описаний:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
  });