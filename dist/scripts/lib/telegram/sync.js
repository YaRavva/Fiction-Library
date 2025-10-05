"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramSyncService = void 0;
exports.downloadFile = downloadFile;
var client_1 = require("./client");
var parser_1 = require("./parser");
var supabase_1 = require("../supabase");
var serverSupabase_1 = require("../serverSupabase");
var path_1 = __importDefault(require("path"));
/**
 * Скачивает файл из Telegram по его ID
 */
function downloadFile(fileId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, client_1.TelegramService.getInstance()];
                case 1:
                    client = _a.sent();
                    return [4 /*yield*/, client.downloadFile(fileId)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error downloading file:', error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
var TelegramSyncService = /** @class */ (function () {
    function TelegramSyncService() {
        this.telegramClient = null;
    }
    TelegramSyncService.getInstance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!TelegramSyncService.instance) return [3 /*break*/, 2];
                        TelegramSyncService.instance = new TelegramSyncService();
                        _a = TelegramSyncService.instance;
                        return [4 /*yield*/, client_1.TelegramService.getInstance()];
                    case 1:
                        _a.telegramClient = _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/, TelegramSyncService.instance];
                }
            });
        });
    };
    TelegramSyncService.prototype.syncMetadata = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var channel, channelId, messages, metadataList, _i, messages_1, msg, anyMsg, metadata, coverUrls, result, photoBuffer, photoKey, photoUrl, err_1, result, photoBuffer, photoKey, photoUrl, err_2, mimeType, result, photoBuffer, photoKey, photoUrl, err_3, error_2;
            var _a;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 30, , 31]);
                        return [4 /*yield*/, this.telegramClient.getMetadataChannel()];
                    case 2:
                        channel = _b.sent();
                        channelId = typeof channel.id === 'object' && channel.id !== null ?
                            channel.id.toString() :
                            channel.id;
                        return [4 /*yield*/, this.telegramClient.getMessages(channelId, limit)];
                    case 3:
                        messages = _b.sent();
                        console.log("\u2705 \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ".concat(messages.length, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439\n"));
                        metadataList = [];
                        _i = 0, messages_1 = messages;
                        _b.label = 4;
                    case 4:
                        if (!(_i < messages_1.length)) return [3 /*break*/, 29];
                        msg = messages_1[_i];
                        anyMsg = msg;
                        console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, "..."));
                        // Пропускаем сообщения без текста
                        if (!msg.text) {
                            console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, " \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C"));
                            return [3 /*break*/, 28];
                        }
                        metadata = parser_1.MetadataParser.parseMessage(msg.text);
                        coverUrls = [];
                        if (!anyMsg.media) return [3 /*break*/, 27];
                        console.log("\uD83D\uDCF8 \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E \u043C\u0435\u0434\u0438\u0430 \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438 ".concat(anyMsg.id, " (\u0442\u0438\u043F: ").concat(anyMsg.media.className, ")"));
                        if (!(anyMsg.media.className === 'MessageMediaWebPage' && ((_a = anyMsg.media.webpage) === null || _a === void 0 ? void 0 : _a.photo))) return [3 /*break*/, 12];
                        console.log("  \u2192 \u0412\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E \u0441 \u0444\u043E\u0442\u043E");
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 10, , 11]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(anyMsg.media.webpage.photo),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 6:
                        result = _b.sent();
                        photoBuffer = result instanceof Buffer ? result : null;
                        if (!photoBuffer) return [3 /*break*/, 8];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 7:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 9];
                    case 8:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        err_1 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438 \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E:", err_1);
                        return [3 /*break*/, 11];
                    case 11: return [3 /*break*/, 27];
                    case 12:
                        if (!anyMsg.media.photo) return [3 /*break*/, 20];
                        console.log("  \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0444\u043E\u0442\u043E");
                        _b.label = 13;
                    case 13:
                        _b.trys.push([13, 18, , 19]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(msg),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 14:
                        result = _b.sent();
                        photoBuffer = result instanceof Buffer ? result : null;
                        if (!photoBuffer) return [3 /*break*/, 16];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 15:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 17];
                    case 16:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 17;
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        err_2 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_2);
                        return [3 /*break*/, 19];
                    case 19: return [3 /*break*/, 27];
                    case 20:
                        if (!anyMsg.media.document) return [3 /*break*/, 27];
                        mimeType = anyMsg.media.document.mimeType;
                        if (!(mimeType && mimeType.startsWith('image/'))) return [3 /*break*/, 27];
                        console.log("  \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442: ".concat(mimeType, ")"));
                        _b.label = 21;
                    case 21:
                        _b.trys.push([21, 26, , 27]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(msg),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 22:
                        result = _b.sent();
                        photoBuffer = result instanceof Buffer ? result : null;
                        if (!photoBuffer) return [3 /*break*/, 24];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 23:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 25];
                    case 24:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 25;
                    case 25: return [3 /*break*/, 27];
                    case 26:
                        err_3 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_3);
                        return [3 /*break*/, 27];
                    case 27:
                        // Добавляем метаданные в список
                        metadataList.push(__assign(__assign({}, metadata), { coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || [] }));
                        _b.label = 28;
                    case 28:
                        _i++;
                        return [3 /*break*/, 4];
                    case 29: return [2 /*return*/, metadataList];
                    case 30:
                        error_2 = _b.sent();
                        console.error('Error in syncMetadata:', error_2);
                        throw error_2;
                    case 31: return [2 /*return*/];
                }
            });
        });
    };
    TelegramSyncService.prototype.downloadBook = function (messageId) {
        return __awaiter(this, void 0, void 0, function () {
            var channel, channelId, messages, message, _i, messages_2, msg, buffer, anyMsg, filenameCandidate, ext, storageKey, displayName, mime, bookRecord, err_4, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 11]);
                        return [4 /*yield*/, this.telegramClient.getFilesChannel()];
                    case 2:
                        channel = _a.sent();
                        // Получаем конкретное сообщение
                        console.log("Getting message ".concat(messageId, " from channel..."));
                        channelId = typeof channel.id === 'object' && channel.id !== null ?
                            channel.id.toString() :
                            channel.id;
                        return [4 /*yield*/, this.telegramClient.getMessages(channelId, 5)];
                    case 3:
                        messages = _a.sent();
                        console.log("Found ".concat(messages.length, " messages"));
                        message = messages[0];
                        if (messageId > 1) {
                            for (_i = 0, messages_2 = messages; _i < messages_2.length; _i++) {
                                msg = messages_2[_i];
                                if (msg.id === messageId) {
                                    message = msg;
                                    break;
                                }
                            }
                        }
                        if (!message) {
                            throw new Error("Message ".concat(messageId, " not found"));
                        }
                        console.log("Downloading file from message ".concat(messageId, "..."));
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(message),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Media download took too long')); }, 45000);
                                })
                            ])];
                    case 4:
                        buffer = _a.sent();
                        if (!buffer) {
                            throw new Error('Failed to download file');
                        }
                        anyMsg = message;
                        filenameCandidate = anyMsg.fileName
                            || (anyMsg.document && anyMsg.document.fileName)
                            || (anyMsg.media && anyMsg.media.document && anyMsg.media.document.fileName)
                            || "book_".concat(anyMsg.id, ".fb2");
                        ext = path_1.default.extname(filenameCandidate) || '.fb2';
                        storageKey = "".concat(anyMsg.id).concat(ext);
                        displayName = filenameCandidate;
                        mime = anyMsg.mimeType
                            || (anyMsg.document && anyMsg.document.mimeType)
                            || (anyMsg.media && anyMsg.media.document && anyMsg.media.document.mimeType)
                            || 'application/octet-stream';
                        // Загружаем в Supabase Storage (bucket 'books')
                        console.log("Uploading file to Supabase Storage...");
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('books', storageKey, Buffer.from(buffer), mime)];
                    case 5:
                        _a.sent();
                        bookRecord = {
                            title: filenameCandidate || "book-".concat(anyMsg.id),
                            author: anyMsg.author || (anyMsg.from && anyMsg.from.username) || 'Unknown',
                            file_url: "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/books/").concat(encodeURIComponent(storageKey)),
                            file_size: buffer.length,
                            file_format: ext.replace('.', ''),
                            telegram_file_id: String(anyMsg.id),
                        };
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, (0, supabase_1.upsertBookRecord)(bookRecord)];
                    case 7:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        err_4 = _a.sent();
                        console.warn('Failed to upsert book record:', err_4);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/, Buffer.from(buffer)];
                    case 10:
                        error_3 = _a.sent();
                        console.error('Error downloading book:', error_3);
                        throw error_3;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Извлекает метаданные из имени файла по различным паттернам
     * @param filename Имя файла
     * @returns Объект с автором и названием
     */
    TelegramSyncService.extractMetadataFromFilename = function (filename) {
        // Убираем расширение файла
        var nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        // Специальная обработка для известных паттернов
        // Паттерн: "Автор - Название"
        var dashPattern = /^([^-–—]+)[\-–—](.+)$/;
        var dashMatch = nameWithoutExt.match(dashPattern);
        if (dashMatch) {
            var author = dashMatch[1].trim();
            var title_1 = dashMatch[2].trim();
            // Особая обработка для случая, когда в названии есть слово "мицелий"
            if (title_1.toLowerCase().includes('мицелий')) {
                title_1 = "\u0446\u0438\u043A\u043B ".concat(title_1);
            }
            // Если в названии есть слово "цикл", переносим его в начало названия
            if (author.toLowerCase().includes('цикл ')) {
                title_1 = "".concat(author, " ").concat(title_1);
                author = author.replace(/цикл\s+/i, '').trim();
            }
            else if (title_1.toLowerCase().includes('цикл ')) {
                title_1 = "\u0446\u0438\u043A\u043B ".concat(title_1.replace(/цикл\s+/i, '').trim());
            }
            // Особая обработка для "Оксфордский цикл"
            if (title_1.toLowerCase().includes('оксфордский')) {
                title_1 = "\u0446\u0438\u043A\u043B ".concat(title_1);
            }
            return { author: author, title: title_1 };
        }
        // Специальная обработка для файлов с несколькими авторами
        // Паттерн: "Автор1_и_Автор2_Название" или "Автор1,_Автор2_Название"
        if (nameWithoutExt.includes('_и_')) {
            var parts = nameWithoutExt.split('_и_');
            if (parts.length === 2) {
                var authorsPart = parts[0].replace(/_/g, ' ').trim();
                var titlePart = parts[1].replace(/_/g, ' ').trim();
                var title_2 = titlePart;
                if (title_2.toLowerCase().includes('мицелий')) {
                    title_2 = "\u0446\u0438\u043A\u043B ".concat(title_2);
                }
                return { author: authorsPart, title: title_2 };
            }
        }
        // Паттерн: "Автор1,_Автор2_Название"
        if (nameWithoutExt.includes(',_')) {
            var parts = nameWithoutExt.split(',_');
            if (parts.length === 2) {
                var authorsPart = parts[0].replace(/_/g, ' ').trim();
                var titlePart = parts[1].replace(/_/g, ' ').trim();
                var title_3 = titlePart;
                if (title_3.toLowerCase().includes('мицелий')) {
                    title_3 = "\u0446\u0438\u043A\u043B ".concat(title_3);
                }
                return { author: authorsPart, title: title_3 };
            }
        }
        // Паттерн: "Хроники" в названии
        if (nameWithoutExt.includes('Хроники')) {
            var words_1 = nameWithoutExt.split('_');
            var chroniclesIndex = words_1.findIndex(function (word) { return word.includes('Хроники'); });
            if (chroniclesIndex > 0) {
                // Авторы - это слова до "Хроники"
                var authors = words_1.slice(0, chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
                var title_4 = words_1.slice(chroniclesIndex).join(' ').replace(/_/g, ' ').trim();
                return { author: authors, title: title_4 };
            }
        }
        // Разбиваем имя файла на слова для более сложного анализа
        var words = nameWithoutExt
            .split(/[_\-\s]+/) // Разделяем по пробелам, подчеркиваниям и дефисам
            .filter(function (word) { return word.length > 0; }) // Убираем пустые слова
            .map(function (word) { return word.trim(); }); // Убираем пробелы
        // Если мало слов, возвращаем как есть
        if (words.length < 2) {
            return {
                author: 'Unknown',
                title: nameWithoutExt
            };
        }
        // Попробуем найти индикаторы названия (цикл, saga, series и т.д.)
        var titleIndicators = ['цикл', ' saga', ' series', 'оксфордский'];
        var titleStartIndex = words.length; // По умолчанию всё название
        var _loop_1 = function (i) {
            var word = words[i].toLowerCase();
            if (titleIndicators.some(function (indicator) { return word.includes(indicator); })) {
                titleStartIndex = i;
                return "break";
            }
        };
        for (var i = 0; i < words.length; i++) {
            var state_1 = _loop_1(i);
            if (state_1 === "break")
                break;
        }
        // Если индикатор найден, авторы - это слова до него, название - от него и далее
        if (titleStartIndex < words.length) {
            var authors = words.slice(0, titleStartIndex).join(' ');
            var title_5 = words.slice(titleStartIndex).join(' ');
            // Особая обработка для случая, когда в названии есть слово "мицелий"
            if (title_5.toLowerCase().includes('мицелий')) {
                title_5 = "\u0446\u0438\u043A\u043B ".concat(title_5);
            }
            // Особая обработка для "Оксфордский цикл"
            if (title_5.toLowerCase().includes('оксфордский')) {
                title_5 = "\u0446\u0438\u043A\u043B ".concat(title_5);
            }
            return {
                author: authors,
                title: title_5
            };
        }
        // Если ничего не подошло, возвращаем как есть
        var title = nameWithoutExt;
        // Особая обработка для случая, когда в названии есть слово "мицелий"
        if (nameWithoutExt.toLowerCase().includes('мицелий')) {
            title = "\u0446\u0438\u043A\u043B ".concat(nameWithoutExt);
        }
        else if (nameWithoutExt.includes('цикл')) {
            title = "\u0446\u0438\u043A\u043B ".concat(nameWithoutExt.replace(/цикл\s*/i, ''));
        }
        else if (nameWithoutExt.toLowerCase().includes('оксфордский')) {
            title = "\u0446\u0438\u043A\u043B ".concat(nameWithoutExt);
        }
        return {
            author: 'Unknown',
            title: title
        };
    };
    /**
     * Скачивает файлы из канала "Архив для фантастики" и добавляет их в очередь загрузки
     * @param limit Количество сообщений для обработки
     * @param addToQueue Флаг, определяющий, добавлять ли файлы в очередь загрузки
     */
    TelegramSyncService.prototype.downloadFilesFromArchiveChannel = function () {
        return __awaiter(this, arguments, void 0, function (limit, addToQueue) {
            var channel, channelId, messages, results, _i, messages_3, msg, anyMsg, filename, attributes, attrFileName, fileId, fileRecord, supabase, dbError_1, downloadTask, supabase, queueError_1, msgError_1, error_4;
            if (limit === void 0) { limit = 10; }
            if (addToQueue === void 0) { addToQueue = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 17, , 18]);
                        // Получаем канал с файлами
                        console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
                        return [4 /*yield*/, this.telegramClient.getFilesChannel()];
                    case 2:
                        channel = _a.sent();
                        channelId = typeof channel.id === 'object' && channel.id !== null ?
                            channel.id.toString() :
                            channel.id;
                        // Получаем сообщения
                        console.log("\uD83D\uDCD6 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 ".concat(limit, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439..."));
                        return [4 /*yield*/, this.telegramClient.getMessages(channelId, limit)];
                    case 3:
                        messages = _a.sent();
                        console.log("\u2705 \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ".concat(messages.length, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439\n"));
                        results = [];
                        _i = 0, messages_3 = messages;
                        _a.label = 4;
                    case 4:
                        if (!(_i < messages_3.length)) return [3 /*break*/, 16];
                        msg = messages_3[_i];
                        anyMsg = msg;
                        console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, "..."));
                        // Проверяем, есть ли в сообщении медиа (файл)
                        if (!anyMsg.media) {
                            console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, " \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043C\u0435\u0434\u0438\u0430, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C"));
                            return [3 /*break*/, 15];
                        }
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 14, , 15]);
                        filename = "book_".concat(anyMsg.id, ".fb2");
                        if (anyMsg.document && anyMsg.document.attributes) {
                            attributes = anyMsg.document.attributes;
                            attrFileName = attributes.find(function (attr) {
                                var attrObj = attr;
                                return attrObj.className === 'DocumentAttributeFilename';
                            });
                            if (attrFileName && attrFileName.fileName) {
                                filename = attrFileName.fileName;
                            }
                        }
                        console.log("  \uD83D\uDCC4 \u041D\u0430\u0439\u0434\u0435\u043D \u0444\u0430\u0439\u043B: ".concat(filename));
                        if (!addToQueue) return [3 /*break*/, 13];
                        fileId = String(anyMsg.id);
                        fileRecord = {
                            telegram_message_id: String(anyMsg.id),
                            channel: 'Архив для фантастики',
                            raw_text: anyMsg.message || '',
                            processed_at: new Date().toISOString()
                        };
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        supabase = serverSupabase_1.serverSupabase;
                        return [4 /*yield*/, supabase.from('telegram_messages').upsert(fileRecord)];
                    case 7:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        dbError_1 = _a.sent();
                        console.warn("  \u26A0\uFE0F \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u0437\u0430\u043F\u0438\u0441\u0438 \u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438:", dbError_1);
                        return [3 /*break*/, 9];
                    case 9:
                        downloadTask = {
                            message_id: String(anyMsg.id),
                            channel_id: String(anyMsg.peerId || channel.id),
                            file_id: fileId,
                            status: 'pending',
                            priority: 0,
                            scheduled_for: new Date().toISOString()
                        };
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        supabase = serverSupabase_1.serverSupabase;
                        return [4 /*yield*/, supabase.from('telegram_download_queue').upsert(downloadTask)];
                    case 11:
                        _a.sent();
                        console.log("  \u2705 \u0424\u0430\u0439\u043B \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438: ".concat(fileId));
                        return [3 /*break*/, 13];
                    case 12:
                        queueError_1 = _a.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0438 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C:", queueError_1);
                        return [3 /*break*/, 13];
                    case 13:
                        results.push({
                            messageId: anyMsg.id,
                            filename: filename,
                            hasMedia: !!anyMsg.media,
                            addedToQueue: addToQueue
                        });
                        return [3 /*break*/, 15];
                    case 14:
                        msgError_1 = _a.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, ":"), msgError_1);
                        return [3 /*break*/, 15];
                    case 15:
                        _i++;
                        return [3 /*break*/, 4];
                    case 16:
                        console.log("\n\uD83D\uDCCA \u0412\u0441\u0435\u0433\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: ".concat(results.length));
                        return [2 /*return*/, results];
                    case 17:
                        error_4 = _a.sent();
                        console.error('Error downloading files from archive channel:', error_4);
                        throw error_4;
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Скачивает и обрабатывает файлы из канала "Архив для фантастики" напрямую (без очереди)
     * @param limit Количество сообщений для обработки
     */
    TelegramSyncService.prototype.downloadAndProcessFilesDirectly = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var channel, channelId, messages, results, _i, messages_4, msg, anyMsg, result, msgError_2, error_5;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 11]);
                        // Получаем канал с файлами
                        console.log('📚 Получаем доступ к каналу "Архив для фантастики"...');
                        return [4 /*yield*/, this.telegramClient.getFilesChannel()];
                    case 2:
                        channel = _a.sent();
                        // Получаем сообщения с таймаутом
                        console.log("\uD83D\uDCD6 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 ".concat(limit, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439..."));
                        channelId = typeof channel.id === 'object' && channel.id !== null ?
                            channel.id.toString() :
                            channel.id;
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.getMessages(channelId, limit),
                                new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error('Timeout getting messages')); }, 30000); })
                            ])];
                    case 3:
                        messages = _a.sent();
                        console.log("\u2705 \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ".concat(messages.length, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439\n"));
                        results = [];
                        _i = 0, messages_4 = messages;
                        _a.label = 4;
                    case 4:
                        if (!(_i < messages_4.length)) return [3 /*break*/, 9];
                        msg = messages_4[_i];
                        anyMsg = msg;
                        console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, "..."));
                        // Проверяем, есть ли в сообщении медиа (файл)
                        if (!anyMsg.media) {
                            console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, " \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043C\u0435\u0434\u0438\u0430, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C"));
                            return [3 /*break*/, 8];
                        }
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.downloadAndProcessSingleFile(anyMsg)];
                    case 6:
                        result = _a.sent();
                        results.push(result);
                        return [3 /*break*/, 8];
                    case 7:
                        msgError_2 = _a.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, ":"), msgError_2);
                        results.push({
                            messageId: anyMsg.id,
                            success: false,
                            error: msgError_2 instanceof Error ? msgError_2.message : 'Unknown error'
                        });
                        return [3 /*break*/, 8];
                    case 8:
                        _i++;
                        return [3 /*break*/, 4];
                    case 9:
                        console.log("\n\uD83D\uDCCA \u0412\u0441\u0435\u0433\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432: ".concat(results.length));
                        return [2 /*return*/, results];
                    case 10:
                        error_5 = _a.sent();
                        console.error('Error downloading files from archive channel:', error_5);
                        throw error_5;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Скачивает и обрабатывает один файл напрямую, привязывая его к указанной книге
     * @param message Сообщение Telegram с файлом
     * @param bookId ID книги, к которой нужно привязать файл (опционально)
     */
    TelegramSyncService.prototype.processFile = function (message, bookId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!bookId) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.downloadAndProcessSingleFileWithBookId(message, bookId)];
                    case 1: 
                    // Если указан ID книги, используем его для привязки
                    return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, this.downloadAndProcessSingleFile(message)];
                    case 3: 
                    // Иначе используем стандартную логику
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Скачивает и обрабатывает один файл, привязывая его к указанной книге
     * @param message Сообщение Telegram с файлом
     * @param bookId ID книги, к которой нужно привязать файл
     */
    TelegramSyncService.prototype.downloadAndProcessSingleFileWithBookId = function (message, bookId) {
        return __awaiter(this, void 0, void 0, function () {
            var anyMsg, buffer, filenameCandidate, ext, mime, fileFormat, attributes, attrFileName, mimeTypes, allowedFormats, _a, author, title, sanitizeFilename, storageKey, displayName, fileUrl, admin, supabase, _b, book, bookError, storageSupabase, removeError_1, updateData, supabase2, _c, updatedBook, updateError, storageSupabase, removeError_2, error_6;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        anyMsg = message;
                        console.log("  \uD83D\uDCE5 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u0430\u0439\u043B \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, "..."));
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 16, , 17]);
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(message),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Media download took too long')); }, 45000);
                                })
                            ])];
                    case 2:
                        buffer = _d.sent();
                        if (!buffer) {
                            throw new Error('Failed to download file');
                        }
                        filenameCandidate = "book_".concat(anyMsg.id, ".fb2");
                        ext = '.fb2';
                        mime = 'application/octet-stream';
                        fileFormat = 'fb2';
                        if (anyMsg.document && anyMsg.document.attributes) {
                            attributes = anyMsg.document.attributes;
                            attrFileName = attributes.find(function (attr) {
                                var attrObj = attr;
                                return attrObj.className === 'DocumentAttributeFilename';
                            });
                            if (attrFileName && attrFileName.fileName) {
                                filenameCandidate = attrFileName.fileName;
                                ext = path_1.default.extname(filenameCandidate) || '.fb2';
                            }
                        }
                        mimeTypes = {
                            '.fb2': 'application/fb2+xml',
                            '.zip': 'application/zip',
                        };
                        allowedFormats = {
                            '.fb2': 'fb2',
                            '.zip': 'zip',
                        };
                        mime = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
                        fileFormat = allowedFormats[ext.toLowerCase()] || 'fb2';
                        _a = TelegramSyncService.extractMetadataFromFilename(filenameCandidate), author = _a.author, title = _a.title;
                        console.log("  \uD83D\uDCCA \u0418\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u043D\u044B\u0435 \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 \u0438\u043C\u0435\u043D\u0438 \u0444\u0430\u0439\u043B\u0430: author=\"".concat(author, "\", title=\"").concat(title, "\""));
                        sanitizeFilename = function (str) {
                            return str
                                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Заменяем недопустимые символы на подчеркивание
                                .replace(/^\.+/, '') // Удаляем точки в начале
                                .replace(/\.+$/, '') // Удаляем точки в конце
                                .substring(0, 255); // Ограничиваем длину имени файла
                        };
                        storageKey = sanitizeFilename("".concat(anyMsg.id).concat(ext));
                        displayName = filenameCandidate;
                        // Загружаем в Supabase Storage (bucket 'books')
                        console.log("  \u2601\uFE0F  \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u0430\u0439\u043B \u0432 Supabase Storage: ".concat(storageKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('books', storageKey, Buffer.from(buffer), mime)];
                    case 3:
                        _d.sent();
                        fileUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/books/").concat(encodeURIComponent(storageKey));
                        admin = (0, supabase_1.getSupabaseAdmin)();
                        if (!admin) {
                            // Если нет доступа к админу, удаляем загруженный файл и выходим
                            console.log("  \u26A0\uFE0F  \u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A Supabase Admin");
                            throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Cannot upsert book record.');
                        }
                        supabase = admin;
                        return [4 /*yield*/, supabase
                                .from('books')
                                .select('title, author')
                                .eq('id', bookId)
                                .single()];
                    case 4:
                        _b = _d.sent(), book = _b.data, bookError = _b.error;
                        if (!(bookError || !book)) return [3 /*break*/, 9];
                        // Если книга не найдена, удаляем загруженный файл из Storage
                        console.log("  \u26A0\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430, \u0443\u0434\u0430\u043B\u044F\u0435\u043C \u0444\u0430\u0439\u043B \u0438\u0437 Storage: ".concat(storageKey));
                        _d.label = 5;
                    case 5:
                        _d.trys.push([5, 7, , 8]);
                        storageSupabase = admin;
                        return [4 /*yield*/, storageSupabase.storage.from('books').remove([storageKey])];
                    case 6:
                        _d.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        removeError_1 = _d.sent();
                        console.log("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0438 \u0444\u0430\u0439\u043B\u0430: ".concat(removeError_1));
                        return [3 /*break*/, 8];
                    case 8: throw new Error("Book with ID ".concat(bookId, " not found for file attachment"));
                    case 9:
                        console.log("  \uD83D\uDCDA \u041F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u043C \u0444\u0430\u0439\u043B \u043A \u043A\u043D\u0438\u0433\u0435: \"".concat(book.title, "\" \u0430\u0432\u0442\u043E\u0440\u0430 ").concat(book.author));
                        updateData = {
                            file_url: fileUrl,
                            file_size: buffer.length,
                            file_format: fileFormat,
                            telegram_file_id: String(anyMsg.id),
                            storage_path: storageKey,
                            updated_at: new Date().toISOString()
                        };
                        supabase2 = admin;
                        return [4 /*yield*/, supabase2
                                .from('books')
                                .update(updateData)
                                .eq('id', bookId)
                                .select()
                                .single()];
                    case 10:
                        _c = _d.sent(), updatedBook = _c.data, updateError = _c.error;
                        if (!updateError) return [3 /*break*/, 15];
                        // Если не удалось обновить книгу, удаляем загруженный файл из Storage
                        console.log("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043D\u0438\u0433\u0438, \u0443\u0434\u0430\u043B\u044F\u0435\u043C \u0444\u0430\u0439\u043B \u0438\u0437 Storage: ".concat(storageKey));
                        _d.label = 11;
                    case 11:
                        _d.trys.push([11, 13, , 14]);
                        storageSupabase = admin;
                        return [4 /*yield*/, storageSupabase.storage.from('books').remove([storageKey])];
                    case 12:
                        _d.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        removeError_2 = _d.sent();
                        console.log("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0438 \u0444\u0430\u0439\u043B\u0430: ".concat(removeError_2));
                        return [3 /*break*/, 14];
                    case 14: throw updateError;
                    case 15:
                        console.log("  \u2705 \u0424\u0430\u0439\u043B \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A \u043A\u043D\u0438\u0433\u0435: \"".concat(book.title, "\""));
                        return [2 /*return*/, {
                                messageId: anyMsg.id,
                                filename: filenameCandidate,
                                fileSize: buffer.length,
                                fileUrl: fileUrl,
                                success: true,
                                bookId: updatedBook.id
                            }];
                    case 16:
                        error_6 = _d.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u0444\u0430\u0439\u043B\u0430 \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, ":"), error_6);
                        throw error_6;
                    case 17: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Скачивает и обрабатывает один файл напрямую
     * @param message Сообщение Telegram с файлом
     */
    TelegramSyncService.prototype.downloadAndProcessSingleFile = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var anyMsg, buffer, filenameCandidate, ext, mime, fileFormat, attributes, attrFileName, mimeTypes, allowedFormats, _a, author, title, sanitizeFilename, storageKey, displayName, fileUrl, bookRecord, result, admin, storageSupabase, err_5, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        anyMsg = message;
                        console.log("  \uD83D\uDCE5 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u0430\u0439\u043B \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, "..."));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 12, , 13]);
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(message),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Media download took too long')); }, 45000);
                                })
                            ])];
                    case 2:
                        buffer = _b.sent();
                        if (!buffer) {
                            throw new Error('Failed to download file');
                        }
                        filenameCandidate = "book_".concat(anyMsg.id, ".fb2");
                        ext = '.fb2';
                        mime = 'application/octet-stream';
                        fileFormat = 'fb2';
                        if (anyMsg.document && anyMsg.document.attributes) {
                            attributes = anyMsg.document.attributes;
                            attrFileName = attributes.find(function (attr) {
                                var attrObj = attr;
                                return attrObj.className === 'DocumentAttributeFilename';
                            });
                            if (attrFileName && attrFileName.fileName) {
                                filenameCandidate = attrFileName.fileName;
                                ext = path_1.default.extname(filenameCandidate) || '.fb2';
                            }
                        }
                        mimeTypes = {
                            '.fb2': 'application/fb2+xml',
                            '.zip': 'application/zip',
                        };
                        allowedFormats = {
                            '.fb2': 'fb2',
                            '.zip': 'zip',
                        };
                        mime = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
                        fileFormat = allowedFormats[ext.toLowerCase()] || 'fb2';
                        _a = TelegramSyncService.extractMetadataFromFilename(filenameCandidate), author = _a.author, title = _a.title;
                        console.log("  \uD83D\uDCCA \u0418\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u043D\u044B\u0435 \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 \u0438\u043C\u0435\u043D\u0438 \u0444\u0430\u0439\u043B\u0430: author=\"".concat(author, "\", title=\"").concat(title, "\""));
                        sanitizeFilename = function (str) {
                            return str
                                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Заменяем недопустимые символы на подчеркивание
                                .replace(/^\.+/, '') // Удаляем точки в начале
                                .replace(/\.+$/, '') // Удаляем точки в конце
                                .substring(0, 255); // Ограничиваем длину имени файла
                        };
                        storageKey = sanitizeFilename("".concat(anyMsg.id).concat(ext));
                        displayName = filenameCandidate;
                        // Загружаем в Supabase Storage (bucket 'books')
                        console.log("  \u2601\uFE0F  \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u0430\u0439\u043B \u0432 Supabase Storage: ".concat(storageKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('books', storageKey, Buffer.from(buffer), mime)];
                    case 3:
                        _b.sent();
                        fileUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/books/").concat(encodeURIComponent(storageKey));
                        bookRecord = {
                            title: title,
                            author: author,
                            file_url: fileUrl,
                            file_size: buffer.length,
                            file_format: fileFormat, // Используем допустимый формат для базы данных
                            telegram_file_id: String(anyMsg.id),
                            storage_path: storageKey,
                            updated_at: new Date().toISOString()
                        };
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 10, , 11]);
                        return [4 /*yield*/, (0, supabase_1.upsertBookRecord)(bookRecord)];
                    case 5:
                        result = _b.sent();
                        if (!result) return [3 /*break*/, 6];
                        console.log("  \u2705 \u0417\u0430\u043F\u0438\u0441\u044C \u043A\u043D\u0438\u0433\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0430/\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0434\u043B\u044F \u0444\u0430\u0439\u043B\u0430: ".concat(filenameCandidate));
                        return [3 /*break*/, 9];
                    case 6:
                        // Если книга не найдена, удаляем загруженный файл из Storage
                        console.log("  \u26A0\uFE0F  \u041A\u043D\u0438\u0433\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430, \u0443\u0434\u0430\u043B\u044F\u0435\u043C \u0444\u0430\u0439\u043B \u0438\u0437 Storage: ".concat(storageKey));
                        admin = (0, supabase_1.getSupabaseAdmin)();
                        if (!admin) return [3 /*break*/, 8];
                        storageSupabase = admin;
                        return [4 /*yield*/, storageSupabase.storage.from('books').remove([storageKey])];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8:
                        console.log("  \u274C \u0424\u0430\u0439\u043B \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u043A \u043A\u043D\u0438\u0433\u0435: ".concat(filenameCandidate));
                        throw new Error('Book not found for file attachment');
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        err_5 = _b.sent();
                        console.warn("  \u26A0\uFE0F  \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438/\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0438 \u0437\u0430\u043F\u0438\u0441\u0438 \u043A\u043D\u0438\u0433\u0438:", err_5);
                        throw err_5;
                    case 11:
                        console.log("  \u2705 \u0424\u0430\u0439\u043B \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D: ".concat(filenameCandidate));
                        return [2 /*return*/, {
                                messageId: anyMsg.id,
                                filename: filenameCandidate,
                                fileSize: buffer.length,
                                fileUrl: fileUrl,
                                success: true
                            }];
                    case 12:
                        error_7 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435 \u0444\u0430\u0439\u043B\u0430 \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ".concat(anyMsg.id, ":"), error_7);
                        throw error_7;
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    TelegramSyncService.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.telegramClient && typeof this.telegramClient.disconnect === 'function')) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Добавляем таймаут для принудительного завершения
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.disconnect(),
                                new Promise(function (resolve) { return setTimeout(resolve, 3000); }) // 3 секунды таймаут
                            ])];
                    case 2:
                        // Добавляем таймаут для принудительного завершения
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_6 = _a.sent();
                        console.warn('Error during shutdown:', err_6);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Импортирует метаданные из Telegram в БД с учётом последних обработанных публикаций
     * @param metadata Массив метаданных книг для импорта
     */
    TelegramSyncService.prototype.importMetadataWithDeduplication = function (metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var processed, added, updated, skipped, errors, details, _i, metadata_1, book, msgId, _a, foundBooks, findError, existingBook, needUpdate, updateData, updateError, upsertError1, newBook, _b, inserted, insertError, upsertError2, error_8;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        processed = 0, added = 0, updated = 0, skipped = 0, errors = 0;
                        details = [];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 14, , 15]);
                        _i = 0, metadata_1 = metadata;
                        _c.label = 2;
                    case 2:
                        if (!(_i < metadata_1.length)) return [3 /*break*/, 13];
                        book = metadata_1[_i];
                        msgId = book.messageId;
                        return [4 /*yield*/, serverSupabase_1.serverSupabase
                                .from('books')
                                .select('*')
                                .eq('title', book.title)
                                .eq('author', book.author)];
                    case 3:
                        _a = _c.sent(), foundBooks = _a.data, findError = _a.error;
                        if (findError) {
                            errors++;
                            details.push({ msgId: msgId, status: 'error', error: findError.message });
                            return [3 /*break*/, 12];
                        }
                        if (!(foundBooks && foundBooks.length > 0)) return [3 /*break*/, 8];
                        existingBook = foundBooks[0];
                        needUpdate = false;
                        updateData = {};
                        // Обновляем только если новые данные лучше существующих
                        if (!existingBook.description && book.description) {
                            updateData.description = book.description;
                            needUpdate = true;
                        }
                        if (book.genres && book.genres.length > 0 && (!existingBook.genres || existingBook.genres.length === 0)) {
                            updateData.genres = book.genres;
                            needUpdate = true;
                        }
                        if (book.tags && book.tags.length > 0 && (!existingBook.tags || existingBook.tags.length === 0)) {
                            updateData.tags = book.tags;
                            needUpdate = true;
                        }
                        // Обновляем обложку, если у новой книги есть обложки, а у существующей нет
                        if (book.coverUrls && book.coverUrls.length > 0 && (!existingBook.cover_url || existingBook.cover_url === '')) {
                            updateData.cover_url = book.coverUrls[0]; // Берем первую обложку
                            needUpdate = true;
                        }
                        if (!needUpdate) return [3 /*break*/, 5];
                        return [4 /*yield*/, serverSupabase_1.serverSupabase.from('books').update(updateData).eq('id', existingBook.id)];
                    case 4:
                        updateError = (_c.sent()).error;
                        if (updateError) {
                            errors++;
                            details.push({ msgId: msgId, status: 'error', error: updateError.message });
                            return [3 /*break*/, 12];
                        }
                        updated++;
                        details.push({
                            msgId: msgId,
                            status: 'updated',
                            bookId: existingBook.id,
                            bookTitle: existingBook.title,
                            bookAuthor: existingBook.author
                        });
                        return [3 /*break*/, 6];
                    case 5:
                        skipped++;
                        details.push({
                            msgId: msgId,
                            status: 'skipped',
                            reason: 'metadata complete',
                            bookTitle: existingBook.title,
                            bookAuthor: existingBook.author
                        });
                        _c.label = 6;
                    case 6: return [4 /*yield*/, serverSupabase_1.serverSupabase.from('telegram_processed_messages').upsert({
                            message_id: String(msgId),
                            channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                            book_id: existingBook.id,
                            processed_at: new Date().toISOString()
                        })];
                    case 7:
                        upsertError1 = (_c.sent()).error;
                        if (upsertError1) {
                            errors++;
                            details.push({ msgId: msgId, status: 'error', error: upsertError1.message });
                        }
                        return [3 /*break*/, 11];
                    case 8:
                        newBook = {
                            title: book.title,
                            author: book.author,
                            description: book.description || '',
                            genres: book.genres || [],
                            tags: book.tags || [],
                            rating: book.rating || null,
                            telegram_file_id: String(msgId),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        // Добавляем обложку, если она есть
                        if (book.coverUrls && book.coverUrls.length > 0) {
                            // @ts-ignore
                            newBook.cover_url = book.coverUrls[0]; // Берем первую обложку
                        }
                        return [4 /*yield*/, serverSupabase_1.serverSupabase.from('books').insert(newBook).select().single()];
                    case 9:
                        _b = _c.sent(), inserted = _b.data, insertError = _b.error;
                        if (insertError) {
                            errors++;
                            details.push({ msgId: msgId, status: 'error', error: insertError.message });
                            return [3 /*break*/, 12];
                        }
                        added++;
                        // @ts-ignore
                        details.push({
                            msgId: msgId,
                            status: 'added',
                            bookId: inserted.id,
                            bookTitle: inserted.title,
                            bookAuthor: inserted.author
                        });
                        return [4 /*yield*/, serverSupabase_1.serverSupabase.from('telegram_processed_messages').upsert({
                                message_id: String(msgId),
                                channel: process.env.TELEGRAM_METADATA_CHANNEL_ID || '',
                                // @ts-ignore
                                book_id: inserted.id,
                                processed_at: new Date().toISOString()
                            })];
                    case 10:
                        upsertError2 = (_c.sent()).error;
                        if (upsertError2) {
                            errors++;
                            details.push({ msgId: msgId, status: 'error', error: upsertError2.message });
                        }
                        _c.label = 11;
                    case 11:
                        processed++;
                        _c.label = 12;
                    case 12:
                        _i++;
                        return [3 /*break*/, 2];
                    case 13: return [2 /*return*/, { processed: processed, added: added, updated: updated, skipped: skipped, errors: errors, details: details }];
                    case 14:
                        error_8 = _c.sent();
                        throw error_8;
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Синхронизирует книги из Telegram канала с учетом уже обработанных сообщений
     * @param limit Количество сообщений для обработки (по умолчанию 100)
     */
    TelegramSyncService.prototype.syncBooks = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var result, lastProcessed, lastProcessedError, offsetId, channel, channelId, messages, metadataList, _i, messages_5, msg, anyMsg, metadata, coverUrls, result_1, photoBuffer, photoKey, photoUrl, err_7, result_2, photoBuffer, photoKey, photoUrl, err_8, mimeType, result_3, photoBuffer, photoKey, photoUrl, err_9, resultImport, error_9;
            var _a;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.telegramClient) {
                            throw new Error('Telegram client not initialized');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 32, , 33]);
                        console.log("\uD83D\uDE80 \u041D\u0430\u0447\u0438\u043D\u0430\u0435\u043C \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044E \u043A\u043D\u0438\u0433 (\u043B\u0438\u043C\u0438\u0442: ".concat(limit, ")"));
                        // Получаем ID последнего обработанного сообщения
                        console.log('🔍 Получаем ID последнего обработанного сообщения...');
                        return [4 /*yield*/, serverSupabase_1.serverSupabase
                                .from('telegram_processed_messages')
                                .select('message_id')
                                .order('processed_at', { ascending: false })
                                .limit(1)
                                .single()];
                    case 2:
                        result = _b.sent();
                        lastProcessed = result.data, lastProcessedError = result.error;
                        offsetId = undefined;
                        if (lastProcessed && lastProcessed.message_id) {
                            // Если есть последнее обработанное сообщение, начинаем с него
                            offsetId = parseInt(lastProcessed.message_id, 10);
                            console.log("  \uD83D\uDCCC \u041D\u0430\u0447\u0438\u043D\u0430\u0435\u043C \u0441 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F ID: ".concat(offsetId));
                        }
                        else {
                            console.log('  🆕 Начинаем с самых новых сообщений');
                        }
                        // Получаем канал с метаданными
                        console.log('📡 Получаем канал с метаданными...');
                        return [4 /*yield*/, this.telegramClient.getMetadataChannel()];
                    case 3:
                        channel = _b.sent();
                        channelId = typeof channel.id === 'object' && channel.id !== null ?
                            channel.id.toString() :
                            channel.id;
                        // Получаем сообщения с пагинацией
                        console.log("\uD83D\uDCE5 \u041F\u043E\u043B\u0443\u0447\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F (\u043B\u0438\u043C\u0438\u0442: ".concat(limit, ", offsetId: ").concat(offsetId, ")..."));
                        return [4 /*yield*/, this.telegramClient.getMessages(channelId, limit, offsetId)];
                    case 4:
                        messages = _b.sent();
                        console.log("\u2705 \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ".concat(messages.length, " \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439\n"));
                        metadataList = [];
                        _i = 0, messages_5 = messages;
                        _b.label = 5;
                    case 5:
                        if (!(_i < messages_5.length)) return [3 /*break*/, 30];
                        msg = messages_5[_i];
                        anyMsg = msg;
                        console.log("\uD83D\uDCDD \u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, "..."));
                        // Пропускаем сообщения без текста
                        if (!msg.text) {
                            console.log("  \u2139\uFE0F \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 ".concat(anyMsg.id, " \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430, \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C"));
                            return [3 /*break*/, 29];
                        }
                        metadata = parser_1.MetadataParser.parseMessage(msg.text);
                        // Добавляем ID сообщения в метаданные
                        metadata.messageId = anyMsg.id;
                        coverUrls = [];
                        if (!anyMsg.media) return [3 /*break*/, 28];
                        console.log("\uD83D\uDCF8 \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E \u043C\u0435\u0434\u0438\u0430 \u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438 ".concat(anyMsg.id, " (\u0442\u0438\u043F: ").concat(anyMsg.media.className, ")"));
                        if (!(anyMsg.media.className === 'MessageMediaWebPage' && ((_a = anyMsg.media.webpage) === null || _a === void 0 ? void 0 : _a.photo))) return [3 /*break*/, 13];
                        console.log("  \u2192 \u0412\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E \u0441 \u0444\u043E\u0442\u043E");
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 11, , 12]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(anyMsg.media.webpage.photo),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 7:
                        result_1 = _b.sent();
                        photoBuffer = result_1 instanceof Buffer ? result_1 : null;
                        if (!photoBuffer) return [3 /*break*/, 9];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 8:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 10];
                    case 9:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        err_7 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438 \u0438\u0437 \u0432\u0435\u0431-\u043F\u0440\u0435\u0432\u044C\u044E:", err_7);
                        return [3 /*break*/, 12];
                    case 12: return [3 /*break*/, 28];
                    case 13:
                        if (!anyMsg.media.photo) return [3 /*break*/, 21];
                        console.log("  \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0444\u043E\u0442\u043E");
                        _b.label = 14;
                    case 14:
                        _b.trys.push([14, 19, , 20]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0444\u043E\u0442\u043E...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(msg),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 15:
                        result_2 = _b.sent();
                        photoBuffer = result_2 instanceof Buffer ? result_2 : null;
                        if (!photoBuffer) return [3 /*break*/, 17];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 16:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 18];
                    case 17:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u043E\u0442\u043E (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 18;
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        err_8 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_8);
                        return [3 /*break*/, 20];
                    case 20: return [3 /*break*/, 28];
                    case 21:
                        if (!anyMsg.media.document) return [3 /*break*/, 28];
                        mimeType = anyMsg.media.document.mimeType;
                        if (!(mimeType && mimeType.startsWith('image/'))) return [3 /*break*/, 28];
                        console.log("  \u2192 \u041E\u0434\u0438\u043D\u043E\u0447\u043D\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442: ".concat(mimeType, ")"));
                        _b.label = 22;
                    case 22:
                        _b.trys.push([22, 27, , 28]);
                        console.log("  \u2192 \u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0435\u043C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435...");
                        return [4 /*yield*/, Promise.race([
                                this.telegramClient.downloadMedia(msg),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Timeout: Downloading media took too long')); }, 30000);
                                })
                            ])];
                    case 23:
                        result_3 = _b.sent();
                        photoBuffer = result_3 instanceof Buffer ? result_3 : null;
                        if (!photoBuffer) return [3 /*break*/, 25];
                        photoKey = "".concat(anyMsg.id, "_").concat(Date.now(), ".jpg");
                        console.log("  \u2192 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432 Storage: covers/".concat(photoKey));
                        return [4 /*yield*/, (0, supabase_1.uploadFileToStorage)('covers', photoKey, Buffer.from(photoBuffer), 'image/jpeg')];
                    case 24:
                        _b.sent();
                        photoUrl = "".concat(process.env.NEXT_PUBLIC_SUPABASE_URL, "/storage/v1/object/public/covers/").concat(photoKey);
                        coverUrls.push(photoUrl);
                        console.log("  \u2705 \u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430: ".concat(photoUrl));
                        return [3 /*break*/, 26];
                    case 25:
                        console.warn("  \u26A0\uFE0F \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (\u043F\u0443\u0441\u0442\u043E\u0439 \u0431\u0443\u0444\u0435\u0440)");
                        _b.label = 26;
                    case 26: return [3 /*break*/, 28];
                    case 27:
                        err_9 = _b.sent();
                        console.error("  \u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0431\u043B\u043E\u0436\u043A\u0438:", err_9);
                        return [3 /*break*/, 28];
                    case 28:
                        // Добавляем метаданные в список
                        metadataList.push(__assign(__assign({}, metadata), { coverUrls: coverUrls.length > 0 ? coverUrls : metadata.coverUrls || [] }));
                        _b.label = 29;
                    case 29:
                        _i++;
                        return [3 /*break*/, 5];
                    case 30:
                        console.log("\uD83D\uDCCA \u0412\u0441\u0435\u0433\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043E \u043C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0445: ".concat(metadataList.length));
                        // Импортируем метаданные с дедупликацией
                        console.log('💾 Импортируем метаданные с дедупликацией...');
                        return [4 /*yield*/, this.importMetadataWithDeduplication(metadataList)];
                    case 31:
                        resultImport = _b.sent();
                        console.log('✅ Импорт метаданных завершен');
                        return [2 /*return*/, resultImport];
                    case 32:
                        error_9 = _b.sent();
                        console.error('Error in syncBooks:', error_9);
                        throw error_9;
                    case 33: return [2 /*return*/];
                }
            });
        });
    };
    return TelegramSyncService;
}());
exports.TelegramSyncService = TelegramSyncService;
