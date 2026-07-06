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
 * Main scoring function: match a file to a book
 */
export function scoreFileToBook(file: FileOption, book: BookOption): MatchResult {
    const fileWords = extractWords(file.file_name);
    const { titleWords, authorWords, allWords: bookWords } = extractBookWords(book);
    
    // Track matches
    const matchedFileWords = new Set<string>();
    const matchedTitleWords = new Set<string>();
    const matchedAuthorWords = new Set<string>();
    
    // Match file words against book words
    for (const fw of fileWords) {
        for (const bw of bookWords) {
            if (fuzzyMatch(fw, bw)) {
                matchedFileWords.add(fw);
                
                // Track where it matched
                if (titleWords.includes(bw)) {
                    matchedTitleWords.add(bw);
                }
                if (authorWords.includes(bw)) {
                    matchedAuthorWords.add(bw);
                }
                break;
            }
        }
    }
    
    // Calculate base metrics
    const matchedCount = matchedFileWords.size;
    const titleMatchCount = matchedTitleWords.size;
    const authorMatch = matchedAuthorWords.size > 0;
    const unmatchedCount = fileWords.length - matchedCount;
    
    // Calculate match ratios
    const fileMatchRatio = fileWords.length > 0 ? matchedCount / fileWords.length : 0;
    const bookMatchRatio = bookWords.length > 0 ? matchedCount / bookWords.length : 0;
    
    // Count unique title matches (non-generic)
    const uniqueTitleMatches = Array.from(matchedTitleWords).filter(
        w => !GENERIC_TITLE_WORDS.has(w)
    ).length;
    
    // === SCORING ALGORITHM ===
    
    let baseScore = 0;
    let titleBonus = 0;
    let authorBonus = 0;
    let coverageBonus = 0;
    let penalties = 0;
    
    // 1. Base score: +20 per matched word
    baseScore = matchedCount * 20;
    
    // 2. Unmatched word penalty: -3 per unmatched word
    penalties += unmatchedCount * 3;
    
    // 3. Match ratio bonus (if >= 60% of file words matched)
    if (fileMatchRatio >= 0.6) {
        coverageBonus += Math.floor(15 * fileMatchRatio * 3);
    }
    
    // 4. Book coverage bonus (if >= 70% of book words matched)
    if (bookMatchRatio >= 0.7) {
        coverageBonus += Math.floor(10 * bookMatchRatio * 2);
    }
    
    // 5. Title match bonuses
    if (titleMatchCount >= 2) {
        titleBonus = titleMatchCount * 12;
    } else if (titleMatchCount === 1) {
        titleBonus = 8;
    }
    
    // 6. Generic title penalty: if all title matches are generic words
    if (titleMatchCount > 0 && uniqueTitleMatches === 0) {
        penalties += 30;
    }
    
    // 7. No author bonuses — same author can have many unrelated series
    // Author is only used in the cap check below to allow higher scores
    // when both title and author align
    
    // 8. Penalties for missing matches
    if (titleMatchCount === 0) {
        penalties += 40;
    } else if (uniqueTitleMatches === 0) {
        penalties += 20; // only generic words matched, likely false positive
    }
    
    // Calculate final score
    let score = baseScore + titleBonus + coverageBonus - penalties;
    
    // Apply caps based on match quality
    if (authorMatch && titleMatchCount >= 2) {
        // No cap - can reach 100
    } else if (authorMatch && titleMatchCount === 1 && uniqueTitleMatches >= 1) {
        score = Math.min(score, 80);
    } else if (titleMatchCount >= 2 && uniqueTitleMatches >= 1) {
        score = Math.min(score, 70);
    } else {
        // Only generic words matched or no author — likely false positive
        score = Math.min(score, 40);
    }
    
    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));
    
    return {
        file,
        book,
        score,
        matchedWords: Array.from(matchedFileWords),
        titleMatchCount,
        authorMatch,
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
