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
exports.TelegramService = void 0;
var telegram_1 = require("telegram");
var sessions_1 = require("telegram/sessions");
var TelegramService = /** @class */ (function () {
    function TelegramService() {
        var apiId = process.env.TELEGRAM_API_ID;
        var apiHash = process.env.TELEGRAM_API_HASH;
        var sessionString = process.env.TELEGRAM_SESSION;
        if (!apiId || !apiHash || !sessionString) {
            throw new Error('TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION must be set in environment variables');
        }
        var session = new sessions_1.StringSession(sessionString);
        this.client = new telegram_1.TelegramClient(session, parseInt(apiId), apiHash, {
            connectionRetries: 5,
        });
    }
    TelegramService.getInstance = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!TelegramService.instance) return [3 /*break*/, 2];
                        TelegramService.instance = new TelegramService();
                        // Connect the client
                        return [4 /*yield*/, TelegramService.instance.client.connect()];
                    case 1:
                        // Connect the client
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, TelegramService.instance];
                }
            });
        });
    };
    TelegramService.prototype.getMetadataChannel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var channelUrl, channelIdentifier, url, inviteHash, result, joinError_1, entity, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channelUrl = process.env.TELEGRAM_METADATA_CHANNEL;
                        if (!channelUrl) {
                            throw new Error('TELEGRAM_METADATA_CHANNEL must be set');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        channelIdentifier = channelUrl;
                        if (!channelUrl.startsWith('http')) return [3 /*break*/, 7];
                        url = new URL(channelUrl);
                        if (!url.pathname.startsWith('/+')) return [3 /*break*/, 6];
                        inviteHash = url.pathname.substring(2);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.client.invoke(new telegram_1.Api.messages.ImportChatInvite({
                                hash: inviteHash
                            }))];
                    case 3:
                        result = _a.sent();
                        // After joining, we should be able to get the entity using the chat ID
                        // The result contains the chat information
                        if (result && 'chats' in result && result.chats.length > 0) {
                            // Use the actual chat ID instead of the invite hash
                            // Convert BigInteger to string
                            channelIdentifier = result.chats[0].id.toString();
                        }
                        else {
                            // Fallback to using the invite hash directly
                            channelIdentifier = inviteHash;
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        joinError_1 = _a.sent();
                        // If user is already participant, we can try to access the channel directly
                        if (joinError_1 && joinError_1.errorMessage === 'USER_ALREADY_PARTICIPANT') {
                            console.log('User is already participant, trying to access channel directly');
                            channelIdentifier = inviteHash;
                        }
                        else {
                            console.warn('Could not join channel via invite link, trying direct access:', joinError_1);
                            channelIdentifier = inviteHash;
                        }
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        // This is a regular channel link, extract the username
                        channelIdentifier = url.pathname.substring(1); // Remove the leading '/'
                        _a.label = 7;
                    case 7: return [4 /*yield*/, this.client.getEntity(channelIdentifier)];
                    case 8:
                        entity = _a.sent();
                        return [2 /*return*/, entity];
                    case 9:
                        error_1 = _a.sent();
                        console.error('Error getting metadata channel:', error_1);
                        throw error_1;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.getFilesChannel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var channelUrl, channelIdentifier, url, inviteHash, result, joinError_2, entity, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        channelUrl = process.env.TELEGRAM_FILES_CHANNEL;
                        if (!channelUrl) {
                            throw new Error('TELEGRAM_FILES_CHANNEL must be set');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        channelIdentifier = channelUrl;
                        if (!channelUrl.startsWith('http')) return [3 /*break*/, 7];
                        url = new URL(channelUrl);
                        if (!url.pathname.startsWith('/+')) return [3 /*break*/, 6];
                        inviteHash = url.pathname.substring(2);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.client.invoke(new telegram_1.Api.messages.ImportChatInvite({
                                hash: inviteHash
                            }))];
                    case 3:
                        result = _a.sent();
                        // After joining, we should be able to get the entity using the chat ID
                        // The result contains the chat information
                        if (result && 'chats' in result && result.chats.length > 0) {
                            // Use the actual chat ID instead of the invite hash
                            // Convert BigInteger to string
                            channelIdentifier = result.chats[0].id.toString();
                        }
                        else {
                            // Fallback to using the invite hash directly
                            channelIdentifier = inviteHash;
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        joinError_2 = _a.sent();
                        // If user is already participant, we can try to access the channel directly
                        if (joinError_2 && joinError_2.errorMessage === 'USER_ALREADY_PARTICIPANT') {
                            console.log('User is already participant, trying to access channel directly');
                            channelIdentifier = inviteHash;
                        }
                        else {
                            console.warn('Could not join channel via invite link, trying direct access:', joinError_2);
                            channelIdentifier = inviteHash;
                        }
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        // This is a regular channel link, extract the username
                        channelIdentifier = url.pathname.substring(1); // Remove the leading '/'
                        _a.label = 7;
                    case 7: return [4 /*yield*/, this.client.getEntity(channelIdentifier)];
                    case 8:
                        entity = _a.sent();
                        return [2 /*return*/, entity];
                    case 9:
                        error_2 = _a.sent();
                        console.error('Error getting files channel:', error_2);
                        throw error_2;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.getMessages = function (chatId_1) {
        return __awaiter(this, arguments, void 0, function (chatId, limit, offsetId) {
            var options, messages, error_3;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        options = { limit: limit };
                        if (offsetId !== undefined) {
                            options.offsetId = offsetId;
                        }
                        return [4 /*yield*/, this.client.getMessages(chatId, options)];
                    case 1:
                        messages = _a.sent();
                        return [2 /*return*/, messages];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error getting messages:', error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.downloadFile = function (fileId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    // This is a placeholder - we'll need to implement proper file downloading
                    throw new Error('downloadFile not implemented for session-based client');
                }
                catch (error) {
                    console.error('Error downloading file:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    // Added methods for sync.ts
    TelegramService.prototype.downloadMedia = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.client) {
                            throw new Error('Telegram client not initialized');
                        }
                        return [4 /*yield*/, this.client.downloadMedia(message, {})];
                    case 1:
                        buffer = _a.sent();
                        if (!buffer) {
                            throw new Error('Failed to download media');
                        }
                        // Convert to Buffer if it's not already
                        if (Buffer.isBuffer(buffer)) {
                            return [2 /*return*/, buffer];
                        }
                        else {
                            // For other types, we assume it's a Uint8Array or similar
                            return [2 /*return*/, Buffer.from(buffer)];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Error downloading media:', error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TelegramService.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!(this.client && this.client.connected)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.disconnect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Error disconnecting Telegram client:', error_5);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return TelegramService;
}());
exports.TelegramService = TelegramService;
