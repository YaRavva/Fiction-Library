"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugMessage = debugMessage;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var sync_1 = require("../lib/telegram/sync");
var parser_1 = require("../lib/telegram/parser");
// Загружаем переменные окружения из .env файла
var envPath = (0, path_1.resolve)(__dirname, '../../.env');
(0, dotenv_1.config)({ path: envPath });
/**
 * Отладочный скрипт для проверки сообщения в Telegram
 * @param messageId ID сообщения для проверки
 */
function debugMessage(messageId) {
    return __awaiter(this, void 0, void 0, function () {
        var syncService, channel, channelId, messages, targetMessage, msg, anyMsg, metadata, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log("\uD83D\uDD0D \u041E\u0442\u043B\u0430\u0434\u043A\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(messageId));
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 1:
                    syncService = _a.sent();
                    // Получаем сообщение из Telegram по ID
                    console.log("\uD83D\uDCE5 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0432\u043E\u043A\u0440\u0443\u0433 ".concat(messageId, " \u0438\u0437 Telegram..."));
                    return [4 /*yield*/, syncService.telegramClient.getMetadataChannel()];
                case 2:
                    channel = _a.sent();
                    if (!channel) {
                        throw new Error('Не удалось получить канал');
                    }
                    channelId = typeof channel.id === 'object' && channel.id !== null ?
                        channel.id.toString() :
                        String(channel.id);
                    return [4 /*yield*/, syncService.telegramClient.getMessages(channelId, 20, messageId)];
                case 3:
                    messages = _a.sent();
                    if (!messages || messages.length === 0) {
                        console.log("\u274C \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B");
                        return [2 /*return*/];
                    }
                    console.log("\u2705 \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ".concat(messages.length, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439"));
                    // Выводим информацию о всех полученных сообщениях
                    messages.forEach(function (msg, index) {
                        var anyMsg = msg;
                        console.log("\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(index + 1, ": ID=").concat(anyMsg.id));
                    });
                    targetMessage = messages.find(function (msg) {
                        var anyMsg = msg;
                        return anyMsg.id == messageId; // Сравниваем как строки, так как ID могут быть разных типов
                    });
                    if (!targetMessage) {
                        console.log("\u274C \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0441 ID ".concat(messageId, " \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0441\u0440\u0435\u0434\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439"));
                        return [2 /*return*/];
                    }
                    msg = targetMessage;
                    anyMsg = msg;
                    console.log("\n\u2705 \u041D\u0430\u0439\u0434\u0435\u043D\u043E \u0446\u0435\u043B\u0435\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0441 ID ".concat(messageId));
                    console.log("\u0422\u0435\u043A\u0441\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F:", anyMsg.message);
                    // Проверяем наличие текста в сообщении
                    if (!anyMsg.message) {
                        console.log("\u274C \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430");
                        return [2 /*return*/];
                    }
                    // Парсим текст сообщения
                    console.log("\n\uD83D\uDCC4 \u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u0442\u0435\u043A\u0441\u0442\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F...");
                    metadata = parser_1.MetadataParser.parseMessage(anyMsg.message);
                    console.log("\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430:", metadata);
                    // Проверяем, есть ли описание в метаданных
                    if (!metadata.description || metadata.description.trim() === '') {
                        console.log("\u2139\uFE0F \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438");
                    }
                    else {
                        console.log("\u2705 \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E: ".concat(metadata.description.substring(0, 100), "..."));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error('❌ Ошибка отладки сообщения:', error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Если скрипт запущен напрямую, выполняем отладку
if (require.main === module) {
    var messageId = parseInt(process.argv[2] || '4578');
    debugMessage(messageId)
        .then(function () {
        console.log('🔒 Скрипт завершен');
        process.exit(0);
    })
        .catch(function (error) {
        console.error('❌ Ошибка при выполнении скрипта:', error);
        process.exit(1);
    });
}
