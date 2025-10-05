"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.TelegramService = void 0;
var telegram_1 = require("telegram");
var sessions_1 = require("telegram/sessions");
/**
 * TelegramService — GramJS wrapper that uses TELEGRAM_SESSION from .env
 * Provides: getMetadataChannel, getFilesChannel, getMessages, downloadMedia
 */
var TelegramService = /** @class */ (function () {
    function TelegramService(sessionString, apiId, apiHash) {
        var session = new sessions_1.StringSession(sessionString || '');
        this.client = new telegram_1.TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5,
        });
    }
    TelegramService.getInstance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var apiIdRaw, apiHash, sessionString, apiId;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (TelegramService.instance)
                            return [2 /*return*/, TelegramService.instance];
                        apiIdRaw = process.env.TELEGRAM_API_ID;
                        apiHash = process.env.TELEGRAM_API_HASH;
                        sessionString = process.env.TELEGRAM_SESSION || '';
                        if (!apiIdRaw || !apiHash) {
                            throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
                        }
                        apiId = parseInt(apiIdRaw, 10);
                        TelegramService.instance = new TelegramService(sessionString, apiId, apiHash);
                        // Start the client. If sessionString is empty, this will require interactive login which we avoid here.
                        return [4 /*yield*/, TelegramService.instance.client.start({
                                phoneNumber: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, Promise.reject('Interactive login not supported here')];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                }); }); },
                                phoneCode: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, Promise.reject('Interactive login not supported here')];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                }); }); },
                                password: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, Promise.reject('Interactive login not supported here')];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                }); }); },
                                onError: function (err) { return console.error('Telegram client error:', err); },
                            })];
                    case 1:
                        // Start the client. If sessionString is empty, this will require interactive login which we avoid here.
                        _a.sent();
                        return [2 /*return*/, TelegramService.instance];
                }
            });
        });
    };
    /**
     * Скачивает файл по его Telegram file_id
     */
    TelegramService.prototype.downloadFile = function (fileId) {
        return __awaiter(this, void 0, void 0, function () {
            var messageId, channel, messages, targetMessage, _i, messages_1, msg, buffer, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        messageId = Number(fileId);
                        return [4 /*yield*/, this.getFilesChannel()];
                    case 1:
                        channel = _a.sent();
                        return [4 /*yield*/, this.getMessages(channel, 20)];
                    case 2:
                        messages = _a.sent();
                        targetMessage = null;
                        if (Array.isArray(messages)) {
                            for (_i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                                msg = messages_1[_i];
                                // @ts-ignore
                                if (msg && msg.id === messageId) {
                                    targetMessage = msg;
                                    break;
                                }
                            }
                        }
                        if (!targetMessage) {
                            throw new Error("Message with ID ".concat(messageId, " not found"));
                        }
                        if (!targetMessage.media) {
                            throw new Error("Message with ID ".concat(messageId, " has no media"));
                        }
                        return [4 /*yield*/, this.downloadMedia(targetMessage)];
                    case 3:
                        buffer = _a.sent();
                        if (buffer instanceof Buffer) {
                            return [2 /*return*/, buffer];
                        }
                        throw new Error('Downloaded content is not a Buffer');
                    case 4:
                        error_1 = _a.sent();
                        console.error('Error downloading file:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.getMetadataChannel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var identifier, username, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        identifier = process.env.TELEGRAM_METADATA_CHANNEL;
                        if (!identifier)
                            throw new Error('TELEGRAM_METADATA_CHANNEL not set');
                        username = identifier.split('/').pop() || identifier;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.client.getEntity(username)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        err_1 = _a.sent();
                        console.error('Error resolving metadata channel:', err_1);
                        throw err_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.getFilesChannel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, hash, dialogs, _i, dialogs_1, dialog, channelTitle, e_1, _a, _b, e_2, e_3, e_4, err_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        url = process.env.TELEGRAM_FILES_CHANNEL;
                        hash = process.env.TELEGRAM_FILES_CHANNEL_HASH;
                        if (!url && !hash)
                            throw new Error('TELEGRAM_FILES_CHANNEL or TELEGRAM_FILES_CHANNEL_HASH must be set');
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 19, , 20]);
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        console.log('Method 1: Getting dialogs to find the channel by name...');
                        return [4 /*yield*/, this.client.getDialogs()];
                    case 3:
                        dialogs = _c.sent();
                        console.log("Found ".concat(dialogs.length, " dialogs"));
                        // Look for the specific channel by name
                        for (_i = 0, dialogs_1 = dialogs; _i < dialogs_1.length; _i++) {
                            dialog = dialogs_1[_i];
                            try {
                                // @ts-ignore
                                if (dialog.entity && dialog.entity.className === 'Channel') {
                                    channelTitle = dialog.entity.title || '';
                                    console.log("Found channel: ".concat(channelTitle));
                                    // Check if this is our target channel
                                    if (channelTitle.includes('Архив для фантастики') ||
                                        channelTitle.includes('Archive for fiction') ||
                                        channelTitle.includes('фантастики')) {
                                        // @ts-ignore
                                        console.log("Found target files channel: ".concat(dialog.entity.title, " (ID: ").concat(dialog.entity.id, ")"));
                                        // @ts-ignore
                                        return [2 /*return*/, dialog.entity];
                                    }
                                }
                            }
                            catch (e) {
                                // Skip entities we can't access
                            }
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _c.sent();
                        console.warn('Could not get dialogs:', e_1.message);
                        return [3 /*break*/, 5];
                    case 5:
                        if (!hash) return [3 /*break*/, 10];
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 9, , 10]);
                        console.log('Method 2: Trying to join channel by invite hash...');
                        _b = (_a = this.client).invoke;
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('telegram')); })];
                    case 7: return [4 /*yield*/, _b.apply(_a, [new (_c.sent()).Api.messages.ImportChatInvite({ hash: hash })])];
                    case 8:
                        _c.sent();
                        console.log('Successfully joined channel (or already a member)');
                        return [3 /*break*/, 10];
                    case 9:
                        e_2 = _c.sent();
                        if (e_2.errorMessage === 'USER_ALREADY_PARTICIPANT') {
                            console.log('Already a member of the channel');
                        }
                        else {
                            console.warn('Could not join files channel by invite:', e_2.message);
                        }
                        return [3 /*break*/, 10];
                    case 10:
                        if (!hash) return [3 /*break*/, 14];
                        _c.label = 11;
                    case 11:
                        _c.trys.push([11, 13, , 14]);
                        console.log('Method 3: Trying to get entity with hash directly...');
                        return [4 /*yield*/, this.client.getEntity(hash)];
                    case 12: return [2 /*return*/, _c.sent()];
                    case 13:
                        e_3 = _c.sent();
                        console.warn('Could not get entity with hash directly:', e_3.message);
                        return [3 /*break*/, 14];
                    case 14:
                        _c.trys.push([14, 17, , 18]);
                        if (!url) return [3 /*break*/, 16];
                        console.log('Method 4: Trying to get entity with full URL...');
                        return [4 /*yield*/, this.client.getEntity(url)];
                    case 15: return [2 /*return*/, _c.sent()];
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        e_4 = _c.sent();
                        console.warn('Could not get entity with full URL:', e_4.message);
                        return [3 /*break*/, 18];
                    case 18: throw new Error("Cannot access files channel with identifier: ".concat(url || hash));
                    case 19:
                        err_2 = _c.sent();
                        console.error('Error getting files channel:', err_2);
                        throw err_2;
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.getMessages = function (entity_1) {
        return __awaiter(this, arguments, void 0, function (entity, limit, offsetId) {
            var params, err_3;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        params = { limit: limit };
                        if (offsetId) {
                            params.offsetId = offsetId;
                        }
                        return [4 /*yield*/, this.client.getMessages(entity, params)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        err_3 = _a.sent();
                        console.error('Error getting messages:', err_3);
                        throw err_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.downloadMedia = function (messageOrMedia) {
        return __awaiter(this, void 0, void 0, function () {
            var err_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        if (!(messageOrMedia.document || messageOrMedia.media)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.downloadMedia(messageOrMedia)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        if (!(messageOrMedia.className === 'Photo')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.client.downloadMedia(messageOrMedia)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        if (!(messageOrMedia.className && messageOrMedia.className.includes('Media'))) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.client.downloadMedia(messageOrMedia)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6: throw new Error("No downloadable media found. Object type: ".concat(messageOrMedia.className || 'unknown'));
                    case 7:
                        err_4 = _a.sent();
                        console.error('Error downloading media:', err_4);
                        throw err_4;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var err_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!(this.client && typeof this.client.disconnect === 'function')) return [3 /*break*/, 2];
                        // Добавляем таймаут для принудительного завершения
                        return [4 /*yield*/, Promise.race([
                                this.client.disconnect(),
                                new Promise(function (resolve) { return setTimeout(resolve, 3000); }) // 3 секунды таймаут
                            ])];
                    case 1:
                        // Добавляем таймаут для принудительного завершения
                        _a.sent();
                        _a.label = 2;
                    case 2: return [3 /*break*/, 4];
                    case 3:
                        err_5 = _a.sent();
                        console.warn('Error during Telegram client disconnect:', err_5);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.instance = null;
    return TelegramService;
}());
exports.TelegramService = TelegramService;
