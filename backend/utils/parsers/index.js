/**
 * Parser service dispatcher
 * Routes to appropriate parser based on file format
 * Provides unified API for parsing any supported document type
 */

const path = require("path");
const { parseTxt, parseTxtContent } = require("./txtParser");
const { parsePdf, parsePdfBuffer } = require("./pdfParser");

/**
 * Detect format from file extension
 * @param {string} filename - Original filename
 * @returns {string} Format code: 'txt', 'pdf', or 'unknown'
 */
function detectFormat(filename) {
  const ext = path.extname(filename || "").toLowerCase();

  if (ext === ".txt") return "txt";
  if (ext === ".pdf") return "pdf";
  return "unknown";
}

/**
 * Check if format is supported
 * @param {string} format - Format code from detectFormat()
 * @returns {boolean}
 */
function isSupportedFormat(format) {
  return ["txt", "pdf"].includes(format);
}

/**
 * Parse file by format
 * @param {string} filePath - Absolute path to file
 * @param {Object} options - Parser options (minLength, etc.)
 * @returns {Promise<string[]>} Array of extracted paragraphs
 * @throws {Error} If format unsupported or parsing fails
 */
async function parseFile(filePath, options = {}) {
  const filename = path.basename(filePath);
  const format = detectFormat(filename);

  if (!isSupportedFormat(format)) {
    throw new Error(
      `Unsupported format: ${format}. Supported formats: txt, pdf`
    );
  }

  console.log(`[PARSER] Detected format: ${format.toUpperCase()} for ${filename}`);

  if (format === "txt") {
    return parseTxt(filePath, options);
  }

  if (format === "pdf") {
    return parsePdf(filePath, options);
  }
}

/**
 * Parse raw content by specified format
 * Useful for testing and direct content parsing
 * @param {string} content - Raw text content
 * @param {string} format - Format: 'txt' or 'pdf' (pdf requires buffer)
 * @param {Object} options - Parser options
 * @returns {Promise<string[]>} Array of paragraphs
 */
async function parseContent(content, format = "txt", options = {}) {
  if (!isSupportedFormat(format)) {
    throw new Error(
      `Unsupported format: ${format}. Supported formats: txt, pdf`
    );
  }

  if (format === "txt") {
    return parseTxtContent(content, options);
  }

  // PDF requires binary buffer, not text content
  throw new Error("PDF format requires file path or buffer, not text content");
}

module.exports = {
  parseFile,
  parseContent,
  detectFormat,
  isSupportedFormat,
  // Export internals for advanced use
  txtParser: require("./txtParser"),
  pdfParser: require("./pdfParser"),
  normalize: require("./normalize"),
};
