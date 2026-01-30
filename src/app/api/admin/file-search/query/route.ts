import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { TelegramService } from "@/lib/telegram/client";

// Используем service role key для доступа ко всем данным
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Извлекает имя файла из сообщения (копия логики из telegram-files)
 */
function getOriginalFilename(message: any): string {
    let originalFilename = `file_${message.id}`;
    try {
        if (message.document?.attributes) {
            for (const attr of message.document.attributes) {
                if (attr.className === "DocumentAttributeFilename" && attr.fileName) {
                    return attr.fileName;
                }
            }
        }
        if (message.document?.fileName) return message.document.fileName;
        if (message.fileName) return message.fileName;
        if (message.media?.document?.fileName) return message.media.document.fileName;
    } catch (e) {
        // ignore
    }
    return originalFilename;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("q");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "15");

        if (!query) {
            return NextResponse.json({ files: [], total: 0 });
        }

        console.log(`🔍 Search query: "${query}" (page: ${page}, limit: ${limit})`);
        const offset = (page - 1) * limit;

        // 1. Ищем подходящие сообщения в индексе
        const { data: messages, count, error } = await supabaseAdmin
            .from("telegram_messages_index")
            .select("message_id, author, title", { count: "exact" })
            .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
            .order("message_id", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        if (!messages || messages.length === 0) {
            return NextResponse.json({ files: [], total: 0, page, limit });
        }

        // 2. Получаем детали файлов из Telegram API для найденных ID
        const telegramClient = await TelegramService.getInstance();
        const channel = await telegramClient.getFilesChannel();
        const channelId = String(channel.id); // или channel.id.toString() в зависимости от типа

        const files = [];
        for (const msgData of messages) {
            try {
                // @ts-ignore
                const msg = await telegramClient.getMessageById(channelId, msgData.message_id);

                // Проверяем наличие файла/медиа
                let hasFile = false;
                let fileSize = 0;
                let mimeType = "application/octet-stream";
                let fileName = `file_${msgData.message_id}`;

                if (msg) {
                    const media = msg.media?.document || msg.media?.photo || msg.document;
                    if (media) {
                        hasFile = true;
                        fileName = getOriginalFilename(msg);
                        fileSize = media.size || 0;
                        mimeType = media.mimeType || "application/octet-stream";
                    }
                }

                if (hasFile && msg) {
                    files.push({
                        message_id: msgData.message_id,
                        file_name: fileName,
                        file_size: fileSize,
                        mime_type: mimeType,
                        caption: msg.message || (`${msgData.author || ''} - ${msgData.title || ''}`),
                        date: msg.date || Date.now() / 1000,
                        relevance_score: 100 // Найден поиском
                    });
                }
            } catch (e) {
                console.error(`Failed to fetch message ${msgData.message_id}`, e);
            }
        }

        return NextResponse.json({
            files,
            total: count || 0,
            page,
            limit
        });

    } catch (error) {
        console.error("Error in file search API:", error);
        return NextResponse.json(
            { error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        );
    }
}
