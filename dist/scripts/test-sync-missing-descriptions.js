"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sync_missing_descriptions_1 = require("./sync-missing-descriptions");
// Тестируем синхронизацию описаний для 5 книг
(0, sync_missing_descriptions_1.syncMissingDescriptions)(5)
    .then(function (result) {
    console.log('Результат синхронизации описаний:', result);
    process.exit(0);
})
    .catch(function (error) {
    console.error('❌ Ошибка при выполнении скрипта:', error);
    process.exit(1);
});
