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
exports.syncMissingCovers = syncMissingCovers;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var sync_1 = require("../lib/telegram/sync");
var supabase_1 = require("../lib/supabase");
var supabase_2 = require("../lib/supabase");
// Загружаем переменные окружения из .env файла
var envPath = (0, path_1.resolve)(__dirname, '../../.env');
(0, dotenv_1.config)({ path: envPath });
/**
 * Синхронизирует обложки для книг, у которых они отсутствуют
 * @param limit Количество книг для обработки
 * @returns Результат синхронизации
 */
function syncMissingCovers() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var supabase, _a, booksWithoutCovers, fetchError, syncService, processed, updated, skipped, errors, _i, booksWithoutCovers_1, book, typedBook, channel, channelId, messages, msg, anyMsg, coverUrls, result, photoBuffer, photoKey, photoUrl, err_1, result, photoBuffer, photoKey, photoUrl, err_2, mimeType, result, photoBuffer, photoKey, photoUrl, err_3, updateData, updateError, error_1, typedBook, error_2;
        var _b;
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 36, , 37]);
                    console.log("\uD83D\uDE80 \u0417\u0430\u043F\u0443\u0441\u043A \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u043E\u0431\u043B\u043E\u0436\u0435\u043A \u0434\u043B\u044F \u043A\u043D\u0438\u0433 \u0431\u0435\u0437 \u043E\u0431\u043B\u043E\u0436\u0435\u043A (\u043B\u0438\u043C\u0438\u0442: ".concat(limit, ")"));
                    // Получаем книги без обложек
                    console.log('🔍 Получаем книги без обложек...');
                    supabase = (0, supabase_1.getSupabaseAdmin)();
                    if (!supabase) {
                        throw new Error('Не удалось создать клиент Supabase');
                    }
                    return [4 /*yield*/, supabase
                            .from('books')
                            .select('*')
                            .is('cover_url', null)
                            .limit(limit)];
                case 1:
                    _a = _c.sent(), booksWithoutCovers = _a.data, fetchError = _a.error;
                    if (fetchError) {
                        throw new Error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u043A\u043D\u0438\u0433 \u0431\u0435\u0437 \u043E\u0431\u043B\u043E\u0436\u0435\u043A: ".concat(fetchError.message));
                    }
                    if (!booksWithoutCovers || booksWithoutCovers.length === 0) {
                        console.log('✅ Нет книг без обложек');
                        return [2 /*return*/, {
                                success: true,
                                message: 'Нет книг без обложек',
                                processed: 0,
                                updated: 0,
                                skipped: 0,
                                errors: 0
                            }];
                    }
                    console.log("\uD83D\uDCCA \u041D\u0430\u0439\u0434\u0435\u043D\u043E ".concat(booksWithoutCovers.length, " \u043A\u043D\u0438\u0433 \u0431\u0435\u0437 \u043E\u0431\u043B\u043E\u0436\u0435\u043A"));
                    return [4 /*yield*/, sync_1.TelegramSyncService.getInstance()];
                case 2:
                    syncService = _c.sent();
                    processed = 0;
                    updated = 0;
                    skipped = 0;
                    errors = 0;
                    _i = 0, booksWithoutCovers_1 = booksWithoutCovers;
                    _c.label = 3;
                case 3:
                    if (!(_i < booksWithoutCovers_1.length)) return [3 /*break*/, 35];
                    book = booksWithoutCovers_1[_i];
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 33, , 34]);
                    typedBook = book;
                    console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u043A\u043D\u0438\u0433\u0443: ".concat(typedBook.author, " - ").concat(typedBook.title));
                    // Проверяем, есть ли у книги telegram_file_id
                    if (!typedBook.telegram_file_id) {
                        console.log("  \u2139\uFE0F \u0423 \u043A\u043D\u0438\u0433\u0438 \u043D\u0435\u0442 telegram_file_id, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 34];
                    }
                    // Получаем сообщение из Telegram по ID
                    console.log("  \uD83D\uDCE5 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(typedBook.telegram_file_id, " \u0438\u0437 Telegram..."));
                    return [4 /*yield*/, syncService.telegramClient.getMetadataChannel()];
                case 5:
                    channel = _c.sent();
                    if (!channel) {
                        throw new Error('Не удалось получить канал');
                    }
                    channelId = typeof channel.id === 'object' && channel.id !== null ?
                        channel.id.toString() :
                        channel.id;
                    return [4 /*yield*/, syncService.telegramClient.getMessages(channelId, 1, parseInt(typedBook.telegram_file_id))];
                case 6:
                    messages = _c.sent();
                    if (!messages || messages.length === 0) {
                        console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                        skipped++;
                        return [3 /*break*/, 34];
                    }
                    msg = messages[0];
                    anyMsg = msg;
                    coverUrls = [];
                    if (!anyMsg.media) return [3 /*break*/, 29];
                    console.log("  \uD83D\uDCF8 \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E \u043C\u0435\u0434\u0438\u0430 \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438 ".concat(anyMsg.id, " (\u0442\u0438\u043F: ").concat(anyMsg.media.className, ")"));
                    if (!(anyMsg.media.className === 'MessageMediaWebPage' && ((_b = anyMsg.media.webpage) === null || _b === void 0 ? void 0 : _b.photo))) return [3 /*break*/, 14];
                    console.log("    \u2192 \u0412\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E \u0441 \u0444\u043E\u0442\u043E");
                    _c.label = 7;
                case 7:
                    _c.trys.push([7, 12, , 13]);
                    console.log("    \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E...");
                    return [4 /*yield*/, Promise.race([
                            syncService.telegramClient.downloadMedia(anyMsg.media.webpage.photo),
                            new Promise(function (_, reject) {
                                return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                            })
                        ])];
                case 8:
                    result = _c.sent();
                    photoBuffer = result instanceof Buffer ? result : null;
                    if (!photoBuffer) return [3 /*break*/, 10];
                    photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                    console.log("    \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                    return [4 /*yield*/, (0, supabase_2.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                case 9:
                    _c.sent();
                    photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                    coverUrls.push(photoUrl);
                    console.log("    \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                    return [3 /*break*/, 11];
                case 10:
                    console.warn("    \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                    _c.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    err_1 = _c.sent();
                    console.error("    \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438 \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E:", err_1);
                    return [3 /*break*/, 13];
                case 13: return [3 /*break*/, 29];
                case 14:
                    if (!anyMsg.media.photo) return [3 /*break*/, 22];
                    console.log("    \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0444\u043E\u0442\u043E");
                    _c.label = 15;
                case 15:
                    _c.trys.push([15, 20, , 21]);
                    console.log("    \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E...");
                    return [4 /*yield*/, Promise.race([
                            syncService.telegramClient.downloadMedia(msg),
                            new Promise(function (_, reject) {
                                return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                            })
                        ])];
                case 16:
                    result = _c.sent();
                    photoBuffer = result instanceof Buffer ? result : null;
                    if (!photoBuffer) return [3 /*break*/, 18];
                    photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                    console.log("    \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                    return [4 /*yield*/, (0, supabase_2.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                case 17:
                    _c.sent();
                    photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                    coverUrls.push(photoUrl);
                    console.log("    \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                    return [3 /*break*/, 19];
                case 18:
                    console.warn("    \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                    _c.label = 19;
                case 19: return [3 /*break*/, 21];
                case 20:
                    err_2 = _c.sent();
                    console.error("    \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_2);
                    return [3 /*break*/, 21];
                case 21: return [3 /*break*/, 29];
                case 22:
                    if (!anyMsg.media.document) return [3 /*break*/, 29];
                    mimeType = anyMsg.media.document.mimeType;
                    if (!(mimeType && mimeType.startsWith('image/'))) return [3 /*break*/, 29];
                    console.log("    \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442: ".concat(mimeType, ")"));
                    _c.label = 23;
                case 23:
                    _c.trys.push([23, 28, , 29]);
                    console.log("    \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435...");
                    return [4 /*yield*/, Promise.race([
                            syncService.telegramClient.downloadMedia(msg),
                            new Promise(function (_, reject) {
                                return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                            })
                        ])];
                case 24:
                    result = _c.sent();
                    photoBuffer = result instanceof Buffer ? result : null;
                    if (!photoBuffer) return [3 /*break*/, 26];
                    photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                    console.log("    \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                    return [4 /*yield*/, (0, supabase_2.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                case 25:
                    _c.sent();
                    photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                    coverUrls.push(photoUrl);
                    console.log("    \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                    return [3 /*break*/, 27];
                case 26:
                    console.warn("    \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                    _c.label = 27;
                case 27: return [3 /*break*/, 29];
                case 28:
                    err_3 = _c.sent();
                    console.error("    \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_3);
                    return [3 /*break*/, 29];
                case 29:
                    if (!(coverUrls.length > 0)) return [3 /*break*/, 31];
                    console.log("  \uD83D\uDD04 \u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C \u043A\u043D\u0438\u0433\u0443 \u0441 \u043E\u0431\u043B\u043E\u0436\u043A\u043E\u0439...");
                    updateData = { cover_url: coverUrls[0] };
                    return [4 /*yield*/, supabase
                            .from('books')
                            .update(updateData)
                            .eq('id', typedBook.id)];
                case 30:
                    updateError = (_c.sent()).error;
                    if (updateError) {
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043D\u0438\u0433\u0438:", updateError);
                        errors++;
                    }
                    else {
                        console.log("  \u2705 \u041A\u043D\u0438\u0433\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0441 \u043E\u0431\u043B\u043E\u0436\u043A\u043E\u0439");
                        updated++;
                    }
                    return [3 /*break*/, 32];
                case 31:
                    console.log("  \u2139\uFE0F \u041E\u0431\u043B\u043E\u0436\u043A\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C");
                    skipped++;
                    _c.label = 32;
                case 32:
                    processed++;
                    return [3 /*break*/, 34];
                case 33:
                    error_1 = _c.sent();
                    typedBook = book;
                    console.error("\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043A\u043D\u0438\u0433\u0438 ".concat(typedBook.author, " - ").concat(typedBook.title, ":"), error_1);
                    errors++;
                    return [3 /*break*/, 34];
                case 34:
                    _i++;
                    return [3 /*break*/, 3];
                case 35:
                    console.log("\u2705 \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043E\u0431\u043B\u043E\u0436\u0435\u043A \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430: ".concat(processed, " \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E, ").concat(updated, " \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E, ").concat(skipped, " \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E, ").concat(errors, " \u043E\u0448\u0438\u0431\u043E\u043A"));
                    return [2 /*return*/, {
                            success: true,
                            message: "\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E ".concat(processed, " \u043A\u043D\u0438\u0433, \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ").concat(updated, " \u043A\u043D\u0438\u0433"),
                            processed: processed,
                            updated: updated,
                            skipped: skipped,
                            errors: errors
                        }];
                case 36:
                    error_2 = _c.sent();
                    console.error('❌ Ошибка синхронизации обложек:', error_2);
                    return [2 /*return*/, {
                            success: false,
                            message: error_2 instanceof Error ? error_2.message : 'Неизвестная ошибка синхронизации обложек',
                            processed: 0,
                            updated: 0,
                            skipped: 0,
                            errors: 1
                        }];
                case 37: return [2 /*return*/];
            }
        });
    });
}
// Если скрипт запущен напрямую, выполняем синхронизацию
if (require.main === module) {
    syncMissingCovers(50)
        .then(function (result) {
        console.log('Результат синхронизации обложек:', result);
        // Принудительно завершаем скрипт через 1 секунду
        setTimeout(function () {
            console.log('🔒 Скрипт принудительно завершен');
            process.exit(0);
        }, 1000);
    })
        .catch(function (error) {
        console.error('❌ Ошибка при выполнении скрипта:', error);
        // Принудительно завершаем скрипт и в случае ошибки
        setTimeout(function () {
            process.exit(1);
        }, 1000);
    });
}
