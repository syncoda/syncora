/**
 * Shared text normalization and paragraph splitting logic
 * Handles CRLF conversion, blank line collapse, whitespace cleanup
 */

/**
 * Apply normalization rules to raw text
 * 1. Convert CRLF/CR to LF
 * 2. Remove trailing whitespace from lines
 * 3. Collapse 3+ blank lines to exactly 2
 * 4. Trim overall
 */
function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")     // Windows CRLF → Unix LF
    .replace(/\r/g, "\n")        // Old Mac CR → Unix LF
    .replace(/[\t ]+\n/g, "\n")  // Remove trailing whitespace on lines
    .replace(/\n{3,}/g, "\n\n")  // Collapse 3+ blank lines to exactly 2
    .trim();                      // Remove leading/trailing whitespace
}

/**
 * Split normalized text into paragraph candidates
 * Uses blank-line boundaries as primary split
 * Returns raw candidates (not yet cleaned)
 */
function splitParagraphCandidates(normalizedText) {
  if (!normalizedText) {
    return [];
  }

  // Split on blank line boundaries (\n\n)
  return normalizedText.split(/\n\s*\n+/);
}

/**
 * Clean individual paragraph
 * - Replace internal newlines with spaces
 * - Collapse multiple spaces
 * - Trim
 */
function cleanParagraph(text) {
  return String(text || "")
    .replace(/\n+/g, " ")    // Replace any newlines with single space
    .replace(/\s+/g, " ")    // Collapse multiple spaces
    .trim();
}

/**
 * Count words in text
 */
function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Check if text looks like a title/heading
 * - All CAPS or Title Case
 * - Very few words (< 5)
 * - Very short length (< 30 chars)
 * - No sentence-ending punctuation
 */
function isLikelyTitle(text) {
  if (!text) return false;

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const length = text.length;

  // Too short or too few words → likely title/heading
  if (length < 30 || wordCount < 3) return true;

  // Check if ALL CAPS (excluding numbers/punctuation)
  const alphaOnly = text.replace(/[^a-zA-Z\s]/g, "");
  if (alphaOnly.length > 5 && alphaOnly.trim() === alphaOnly.trim().toUpperCase()) {
    return true;
  }

  // Check if Title Case with no ending punctuation
  if (wordCount < 5) {
    const hasEndPunctuation = /[.!?;:]$/.test(text.trim());
    if (!hasEndPunctuation) return true;
  }

  // Average word length check - if all words very short, likely title/list
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;
  if (wordCount <= 4 && avgWordLength < 5) return true;

  return false;
}

/**
 * Check if paragraph has coherent content (not just fragments)
 * - Minimum word count (default 15 words = ~50-60 chars)
 * - Minimum character length
 * - Not just numbers/symbols
 * - Has actual readable content
 */
function isValidParagraph(text, options = {}) {
  const {
    minWords = 15,        // At least 15 words
    minCharacters = 50,   // At least 50 characters
  } = options;

  if (!text || text.length < minCharacters) return false;

  const wordCount = countWords(text);
  if (wordCount < minWords) return false;

  // Check if it's mostly numbers/punctuation/symbols (not real content)
  const alphaContent = text.replace(/[^a-zA-Z\s]/g, "");
  const alphaRatio = alphaContent.replace(/\s/g, "").length / text.replace(/\s/g, "").length;
  if (alphaRatio < 0.5) return false; // Less than 50% alphabetic = likely junk

  // Reject if looks like a title/heading
  if (isLikelyTitle(text)) return false;

  return true;
}

/**
 * Extract paragraphs from raw text with STRICT rules
 * Applies full normalization + splitting + cleaning + validation pipeline
 * Returns only valid, substantial paragraphs
 */
function extractParagraphs(rawText, options = {}) {
  const {
    minLength = 0,
    minWords = 15,        // NEW: Minimum meaningful paragraph
    minCharacters = 50,   // NEW: Reject very short fragments
    strict = true,        // NEW: Apply strict validation rules
  } = options;

  const normalized = normalizeText(rawText);
  const candidates = splitParagraphCandidates(normalized);

  let paragraphs = candidates
    .map(cleanParagraph)
    .filter((p) => p.length > minLength);

  // Apply STRICT filtering if enabled (default: true)
  if (strict) {
    paragraphs = paragraphs.filter((p) =>
      isValidParagraph(p, { minWords, minCharacters })
    );
  }

  return paragraphs;
}

 /**
 * Extract paragraphs with metadata
 * Useful for debugging and testing
 */
function extractParagraphsWithMetadata(rawText, options = {}) {
  const {
    minWords = 15,
    minCharacters = 50,
    strict = true,
  } = options;

  const normalized = normalizeText(rawText);
  const candidates = splitParagraphCandidates(normalized);

  return {
    rawLength: rawText.length,
    normalizedLength: normalized.length,
    candidateCount: candidates.length,
    paragraphs: candidates
      .map((candidate, idx) => {
        const cleaned = cleanParagraph(candidate);
        const isValidPara = strict ? isValidParagraph(cleaned, { minWords, minCharacters }) : cleaned.length > 0;
        return {
          index: idx,
          text: cleaned,
          length: cleaned.length,
          rawLength: candidate.length,
          wordCount: countWords(cleaned),
          isEmpty: cleaned.length === 0,
          isTitle: isLikelyTitle(cleaned),
          isValid: isValidPara,
        };
      })
      .filter((p) => (strict ? p.isValid : !p.isEmpty)),
  };
}

module.exports = {
  normalizeText,
  splitParagraphCandidates,
  cleanParagraph,
  countWords,
  isLikelyTitle,
  isValidParagraph,
  extractParagraphs,
  extractParagraphsWithMetadata,
};
