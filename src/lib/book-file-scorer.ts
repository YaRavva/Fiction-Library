/**
 * Unified scoring engine for file-book matching
 * Replaces 3 duplicate scoring systems with one clean implementation
 */

import { lemmatizeWord } from "./lemmatizer";

// Types
export interface FileOption {
    message_id: number;
    file_name: string;
    mime_type?: string;
    file_size?: number;
}

export interface BookOption {
    id: string;
    title: string;
    author: string;
    publication_year?: number;
}

export interface MatchResult {
    file: FileOption;
    book: BookOption;
    score: number;
    matchedWords: string[];
    titleMatchCount: number;
    authorMatch: boolean;
    fileAuthorParsed?: string;
    fileTitleParsed?: string;
    details: {
        baseScore: number;
        titleBonus: number;
        authorBonus: number;
        coverageBonus: number;
        penalties: number;
    };
}

// Normalization and word extraction

const NORMALIZATION_MAP: Record<string, string> = {
    'ё': 'е',
};

const STOP_WORDS = new Set([
    // Russian conjunctions and particles
    'и', 'или', 'а', 'но', 'да', 'же', 'ни', 'не', 'то', 'ли', 'бы', 'уж', 'в', 'на', 'с', 'к', 'по', 'для', 'из', 'о', 'об', 'от', 'до', 'за', 'между', 'через', 'после', 'перед', 'при',
    // Book-specific stop words
    'цикл', 'серия', 'книга', 'том', 'тома', 'томе', 'томов', 'часть', 'частей', 'части', 'глава', 'глав', 'главы',
    // File extensions and metadata
    'zip', 'fb2', 'ru', 'en', 'djvu', 'pdf', 'epub', 'mobi', 'txt', 'doc', 'docx',
    // Common filler words
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
]);

const GENERIC_TITLE_WORDS = new Set([
    'мир', 'история', 'хроника', 'время', 'жизнь', 'смерть', 'война', 'судьба', 'тайна', 'путь',
    'земля', 'небо', 'вода', 'огонь', 'свет', 'тьма', 'город', 'лес', 'море', 'гора',
    'король', 'принц', 'принцесса', 'рыцарь', 'маг', 'волшебник', 'дракон', 'герой', 'враг', 'друг',
    'начало', 'конец', 'середина', 'часть', 'том', 'книга', 'выпуск', 'сборник', 'антология',
    // Genre descriptors that shouldn't contribute to matching
    'роман', 'эпопе', 'повест', 'рассказ', 'поэм', 'сказк', 'очерк', 'пьес',
]);

/**
 * Normalize text: lowercase, replace ё→е, remove extra whitespace
 */
export function normalizeText(text: string): string {
    // NFC normalize first to handle combined characters (и + breve → й, etc.)
    let result = text.normalize('NFC').toLowerCase().trim();
    
    // Replace ё→е
    for (const [from, to] of Object.entries(NORMALIZATION_MAP)) {
        result = result.replace(new RegExp(from, 'g'), to);
    }
    
    // Remove extra whitespace
    result = result.replace(/\s+/g, ' ');
    
    return result;
}

/**
 * Extract meaningful words from text with lemmatization
 */
export function extractWords(text: string): string[] {
    const normalized = normalizeText(text);
    
    // Split on various delimiters
    const rawWords = normalized.split(/[\s\-_()[\]{}/\\"'`~!@#$%^&*+=|;:<>?]+/);
    
    const words: string[] = [];
    const seen = new Set<string>();
    
    for (const raw of rawWords) {
        // Skip empty, very short, or stop words
        if (raw.length <= 1 || STOP_WORDS.has(raw)) {
            continue;
        }
        
        // Remove year patterns (2023, (2023), etc.)
        if (/^\d{4}$/.test(raw)) {
            continue;
        }
        
        // Remove language codes
        if (/^(ru|en|de|fr|es|it|pl|uk|by|kz)$/.test(raw)) {
            continue;
        }
        
        // Lemmatize
        const lemma = lemmatizeWord(raw);
        
        // Skip if too short after lemmatization
        if (lemma.length <= 1) {
            continue;
        }
        
        // Deduplicate
        if (!seen.has(lemma)) {
            seen.add(lemma);
            words.push(lemma);
        }
    }
    
    return words;
}

/**
 * Extract words separately for title and author
 */
export function extractBookWords(book: BookOption): {
    titleWords: string[];
    authorWords: string[];
    allWords: string[];
} {
    const titleWords = extractWords(book.title);
    const authorWords = extractWords(book.author);
    
    // Combine and deduplicate
    const allWordsSet = new Set([...titleWords, ...authorWords]);
    const allWords = Array.from(allWordsSet);
    
    return { titleWords, authorWords, allWords };
}

/**
 * Fuzzy match check: exact match for short words, levenshtein <= 1 for longer
 */
function fuzzyMatch(a: string, b: string): boolean {
    if (a === b) return true;
    
    // For short words, require exact match
    if (a.length <= 3 || b.length <= 3) {
        return false;
    }
    
    // Simple levenshtein check (max distance 1)
    const lenA = a.length;
    const lenB = b.length;
    
    if (Math.abs(lenA - lenB) > 1) return false;
    
    // Quick check: count differences
    let diffs = 0;
    const minLen = Math.min(lenA, lenB);
    
    for (let i = 0; i < minLen; i++) {
        if (a[i] !== b[i]) {
            diffs++;
            if (diffs > 1) return false;
        }
    }
    
    return true;
}

/**
 * Parse a filename into author and title parts.
 * Common Telegram patterns: "Author - Title.ext", "Author – Title.ext"
 * If no separator found, the whole name is treated as the title.
 */
export function parseFileName(fileName: string): { fileAuthor?: string; fileTitle: string } {
    let name = fileName;
    // Remove extension
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) {
        name = name.substring(0, dotIndex);
    }

    // Try dash separators in order of preference (longest first to avoid false splits)
    const separators = [' — ', ' – ', ' - ', ' —', ' –', ' -'];
    for (const sep of separators) {
        const idx = name.indexOf(sep);
        if (idx > 0) {
            const author = name.substring(0, idx).trim();
            const title = name.substring(idx + sep.length).trim();
            if (author && title) {
                // Make sure title is not empty after cleanup
                const cleanTitle = title.replace(/[[\](){}【】《》""「」『』]/g, '').trim();
                if (cleanTitle) {
                    return { fileAuthor: author, fileTitle: cleanTitle };
                }
            }
        }
    }

    return { fileTitle: name };
}

/**
 * Check if parsed file author matches the book author.
 * Requires meaningful overlap: at least as many matching words as the shorter name's length.
 * This prevents false matches on shared first names (Алексей vs Алексей).
 */
export function checkAuthorMatch(
    fileAuthorWords: string[],
    bookAuthorWords: string[]
): boolean {
    if (fileAuthorWords.length === 0 || bookAuthorWords.length === 0) {
        return false;
    }

    let matches = 0;
    for (const fw of fileAuthorWords) {
        for (const bw of bookAuthorWords) {
            if (fuzzyMatch(fw, bw)) {
                matches++;
                break;
            }
        }
    }

    // Require ALL words from the shorter name to match.
    // Е.g., "Алексей Губарев"(2) vs "Алексей Гришин"(2): 1/2 → false.
    // Е.g., "Дем Михайлов"(2) vs "Дем Михайлов"(2): 2/2 → true.
    // Е.g., "А. Глушков"(1) vs "Роман Глушков"(2): 1/1 → true (surname matched).
    const required = Math.min(fileAuthorWords.length, bookAuthorWords.length);
    return matches >= required;
}

/**
 * Main scoring function: match a file to a book.
 *
 * Key design decision: filename is parsed into AUTHOR and TITLE parts.
 * File TITLE words are matched against book TITLE words only.
 * File AUTHOR words are checked against book AUTHOR words separately (boolean, no score).
 * Cross-domain matching is FORBIDDEN — prevents "роман"(жанр) ↔ "Роман"(имя).
 */
export function scoreFileToBook(file: FileOption, book: BookOption): MatchResult {
    const { fileAuthor, fileTitle } = parseFileName(file.file_name);
    const fileTitleWords = extractWords(fileTitle);
    const fileAuthorWords = fileAuthor ? extractWords(fileAuthor) : [];
    const { titleWords: bookTitleWords, authorWords: bookAuthorWords } = extractBookWords(book);

    // Match file TITLE words against book TITLE words only
    const matchedFileTitleWords = new Set<string>();
    const matchedBookTitleWords = new Set<string>();

    for (const fw of fileTitleWords) {
        for (const bw of bookTitleWords) {
            if (fuzzyMatch(fw, bw)) {
                matchedFileTitleWords.add(fw);
                matchedBookTitleWords.add(bw);
                break;
            }
        }
    }

    // Check author match separately (parsed file author vs book author)
    const authorMatch = checkAuthorMatch(fileAuthorWords, bookAuthorWords);

    // Calculate base metrics (based ONLY on title matching)
    const matchedCount = matchedFileTitleWords.size;
    const titleMatchCount = matchedBookTitleWords.size;
    const unmatchedCount = fileTitleWords.length - matchedCount;

    const fileMatchRatio = fileTitleWords.length > 0 ? matchedCount / fileTitleWords.length : 0;
    const bookMatchRatio = bookTitleWords.length > 0 ? matchedCount / bookTitleWords.length : 0;

    // Count unique title matches (non-generic)
    const uniqueTitleMatches = Array.from(matchedBookTitleWords).filter(
        w => !GENERIC_TITLE_WORDS.has(w)
    ).length;

    // === SCORING ALGORITHM ===
    let baseScore = 0;
    let titleBonus = 0;
    let authorBonus = 0;
    let coverageBonus = 0;
    let penalties = 0;

    // 1. Base score: +20 per matched title word
    baseScore = matchedCount * 20;

    // 2. Unmatched word penalty: -3 per unmatched title word
    penalties += unmatchedCount * 3;

    // 3. Match ratio bonus (if >= 60% of file title words matched)
    if (fileMatchRatio >= 0.6) {
        coverageBonus += Math.floor(15 * fileMatchRatio * 3);
    }

    // 4. Book coverage bonus (if >= 70% of book title words matched)
    if (bookMatchRatio >= 0.7) {
        coverageBonus += Math.floor(10 * bookMatchRatio * 2);
    }

    // 5. Title match bonuses
    if (titleMatchCount >= 2) {
        titleBonus = titleMatchCount * 12;
    } else if (titleMatchCount === 1) {
        titleBonus = 8;
    }

    // 6. Generic title penalty
    if (titleMatchCount > 0 && uniqueTitleMatches === 0) {
        penalties += 30;
    }

    // 7. Only generic or no matches
    if (titleMatchCount === 0) {
        penalties += 40;
    } else if (uniqueTitleMatches === 0) {
        penalties += 20;
    }

    // Calculate final score
    let score = baseScore + titleBonus + coverageBonus - penalties;

    // Apply caps: author match is a confirmation, not a score multiplier
    if (authorMatch && titleMatchCount >= 2) {
        // Full confidence — no cap
    } else if (authorMatch && titleMatchCount === 1 && uniqueTitleMatches >= 1) {
        score = Math.min(score, 80);
    } else if (titleMatchCount >= 2 && uniqueTitleMatches >= 1) {
        score = Math.min(score, 70);
    } else {
        score = Math.min(score, 40);
    }

    score = Math.max(0, Math.min(100, score));

    return {
        file,
        book,
        score,
        matchedWords: Array.from(matchedFileTitleWords),
        titleMatchCount,
        authorMatch,
        fileAuthorParsed: fileAuthor || undefined,
        fileTitleParsed: fileTitle,
        details: {
            baseScore,
            titleBonus,
            authorBonus,
            coverageBonus,
            penalties,
        },
    };
}

/**
 * Find the best matching file for a book from a list of files
 */
export function findBestFileForBook(
    book: BookOption,
    files: FileOption[],
    threshold: number = 50,
): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    
    for (const file of files) {
        const result = scoreFileToBook(file, book);
        
        if (result.score >= threshold) {
            if (!bestMatch || result.score > bestMatch.score) {
                bestMatch = result;
            }
        }
    }
    
    return bestMatch;
}

/**
 * Find the best matching book for a file from a list of books
 */
export function findBestBookForFile(
    file: FileOption,
    books: BookOption[],
    threshold: number = 50,
): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    
    for (const book of books) {
        const result = scoreFileToBook(file, book);
        
        if (result.score >= threshold) {
            if (!bestMatch || result.score > bestMatch.score) {
                bestMatch = result;
            }
        }
    }
    
    return bestMatch;
}

/**
 * Batch matching: match all files to all books in a single pass
 * Returns a map of bookId -> best file match
 */
export function batchMatchFilesToBooks(
    files: FileOption[],
    books: BookOption[],
    threshold: number = 50,
): Map<string, MatchResult> {
    const matches = new Map<string, MatchResult>();
    
    // Score every file against every book
    for (const file of files) {
        for (const book of books) {
            const result = scoreFileToBook(file, book);
            
            if (result.score >= threshold) {
                const existing = matches.get(book.id);
                
                // Keep the best match for each book
                if (!existing || result.score > existing.score) {
                    matches.set(book.id, result);
                }
            }
        }
    }
    
    return matches;
}

/**
 * Check if a file is relevant to any book above threshold
 */
export function isFileRelevant(
    file: FileOption,
    books: BookOption[],
    threshold: number = 50,
): boolean {
    for (const book of books) {
        const result = scoreFileToBook(file, book);
        if (result.score >= threshold) {
            return true;
        }
    }
    return false;
}

export default {
    normalizeText,
    extractWords,
    extractBookWords,
    scoreFileToBook,
    findBestFileForBook,
    findBestBookForFile,
    batchMatchFilesToBooks,
    isFileRelevant,
};
