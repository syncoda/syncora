/**
 * Text file parser for .txt documents
 * Simple UTF-8 read + normalization pipeline
 */

const fs = require("fs/promises");
const { extractParagraphs } = require("./normalize");

/**
 * Parse .txt file
 * @param {string} filePath - Path to .txt file
 * @param {Object} options - Extraction options
 * @returns {Promise<string[]>} Array of paragraphs
 */
async function parseTxt(filePath, options = {}) {
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    return extractParagraphs(rawText, options);
  } catch (error) {
    throw new Error(`Failed to parse TXT file: ${error.message}`);
  }
}

/**
 * Parse text content directly (for testing and API use)
 * @param {string} content - Raw text content
 * @param {Object} options - Extraction options
 * @returns {string[]} Array of paragraphs
 */
function parseTxtContent(content, options = {}) {
  return extractParagraphs(content, options);
}

module.exports = {
  parseTxt,
  parseTxtContent,
};
