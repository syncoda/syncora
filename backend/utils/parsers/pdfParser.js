/**
 * PDF parser for .pdf documents
 * Uses pdf-parse library + normalization pipeline
 */

const fs = require("fs/promises");
const pdfParse = require("pdf-parse");
const { extractParagraphs } = require("./normalize");

/**
 * Parse PDF file
 * @param {string} filePath - Path to .pdf file
 * @param {Object} options - Extraction options
 * @returns {Promise<string[]>} Array of paragraphs
 */
async function parsePdf(filePath, options = {}) {
  try {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text || "";

    if (!rawText) {
      return [];
    }

    // Apply PDF-specific cleanup heuristics before normalization
    let cleaned = cleanPdfText(rawText);

    // Then apply standard paragraph extraction
    return extractParagraphs(cleaned, options);
  } catch (error) {
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  }
}

/**
 * Clean common PDF artifacts before normalization
 * - Remove page numbers (common patterns: "1", "Page 1", etc.)
 * - Remove running headers/footers (repeated short text)
 * - Fix hyphenated words broken across lines
 */
function cleanPdfText(text) {
  if (!text) return "";

  let cleaned = text;

  // Remove common page number patterns (line with only digits or "Page N")
  cleaned = cleaned.replace(/^\s*(?:Page\s+)?\d+\s*$/gm, "");

  // Remove consecutive duplicate lines (common header/footer artifact)
  const lines = cleaned.split("\n");
  const deduped = [];
  let lastLine = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Only skip if this line is same as last AND it's very short (likely header/footer)
    if (trimmed && trimmed === lastLine && trimmed.length < 50) {
      continue;
    }
    deduped.push(line);
    lastLine = trimmed;
  }

  cleaned = deduped.join("\n");

  // Fix hyphenated words broken across lines (e.g., "hypen-\nated" → "hyphenated")
  cleaned = cleaned.replace(/(\w+)-\n(\w+)/g, "$1$2");

  return cleaned;
}

/**
 * Parse PDF content directly (for testing)
 * Note: requires actual PDF binary, typically from file
 */
async function parsePdfBuffer(buffer, options = {}) {
  try {
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text || "";

    if (!rawText) {
      return [];
    }

    let cleaned = cleanPdfText(rawText);
    return extractParagraphs(cleaned, options);
  } catch (error) {
    throw new Error(`Failed to parse PDF buffer: ${error.message}`);
  }
}

module.exports = {
  parsePdf,
  parsePdfBuffer,
  cleanPdfText,
};
