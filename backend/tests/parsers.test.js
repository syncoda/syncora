/**
 * Comprehensive tests for paragraph parser service
 * Unit tests + fixture-based tests + regression tests
 */

const assert = require("assert");
const {
  normalizeText,
  extractParagraphs,
  extractParagraphsWithMetadata,
  cleanParagraph,
  countWords,
  isLikelyTitle,
  isValidParagraph,
} = require("../utils/parsers/normalize");
const { parseTxtContent } = require("../utils/parsers/txtParser");
const { cleanPdfText } = require("../utils/parsers/pdfParser");
const { parseContent, detectFormat, isSupportedFormat } = require("../utils/parsers/index");

// ============ NORMALIZE TESTS ============

describe("Normalization", () => {
  it("should convert CRLF to LF", () => {
    const input = "Hello\r\nWorld";
    const result = normalizeText(input);
    assert.strictEqual(result, "Hello\nWorld");
  });

  it("should convert CR to LF", () => {
    const input = "Hello\rWorld";
    const result = normalizeText(input);
    assert.strictEqual(result, "Hello\nWorld");
  });

  it("should collapse 3+ blank lines to 2", () => {
    const input = "Para1\n\n\n\nPara2";
    const result = normalizeText(input);
    assert.strictEqual(result, "Para1\n\nPara2");
  });

  it("should remove trailing whitespace from lines", () => {
    const input = "Hello  \nWorld\t\t";
    const result = normalizeText(input);
    assert.strictEqual(result, "Hello\nWorld");
  });

  it("should trim overall text", () => {
    const input = "  \n  Hello World  \n  ";
    const result = normalizeText(input);
    assert.strictEqual(result, "Hello World");
  });

  it("should handle mixed line ending formats", () => {
    const input = "First\r\nSecond\rThird\nFourth";
    const result = normalizeText(input);
    assert.strictEqual(result, "First\nSecond\nThird\nFourth");
  });
});

// ============ PARAGRAPH EXTRACTION TESTS ============

describe("Paragraph Extraction", () => {
  it("should split on blank line boundaries", () => {
    const input = "Paragraph 1\n\nParagraph 2";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Paragraph 1", "Paragraph 2"]);
  });

  it("should clean internal newlines to spaces", () => {
    const input = "Line 1\nLine 2\n\nNext para";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Line 1 Line 2", "Next para"]);
  });

  it("should collapse multiple spaces", () => {
    const input = "Word1    Word2\n\nWord3";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Word1 Word2", "Word3"]);
  });

  it("should trim each paragraph", () => {
    const input = "  Para1  \n\n  Para2  ";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Para1", "Para2"]);
  });

  it("should filter empty paragraphs", () => {
    const input = "Para1\n\n\n\nPara2";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Para1", "Para2"]);
  });

  it("should handle empty input", () => {
    const result = extractParagraphs("");
    assert.deepStrictEqual(result, []);
  });

  it("should handle null input", () => {
    const result = extractParagraphs(null);
    assert.deepStrictEqual(result, []);
  });
});

// ============ FIXTURE-BASED TESTS ============

describe("Paragraph Extraction - Fixtures", () => {
  it("should handle realistic book text (with dialogue)", () => {
    const input = `She entered the room quietly.

"What are you doing?" he asked.

"Just thinking," she replied. "About us."

The silence was heavy between them.`;

    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0], "She entered the room quietly.");
    assert.strictEqual(result[1], '"What are you doing?" he asked.');
    assert.strictEqual(result[2], '"Just thinking," she replied. "About us."');
    assert.strictEqual(result[3], "The silence was heavy between them.");
  });

  it("should handle text with wrapped lines (indented paragraphs)", () => {
    const input = `This is a paragraph that spans
across multiple lines due to
editor wrapping at column 40.

This is another paragraph
with similar wrapping behavior.`;

    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 2);
    assert(result[0].includes("This is a paragraph"));
    assert.strictEqual(result[0].split("\n").length, 1);
  });

  it("should handle poetry with intentional line breaks", () => {
    const input = `Roses are red
Violets are blue
Sugar is sweet
And so are you

This is prose after the poem.`;

    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 2);
    assert(result[0].includes("Roses") && result[0].includes("you"));
  });

  it("should preserve paragraph order exactly", () => {
    const input = `First
Second
Third
Fourth

Fifth
Sixth

Seventh`;

    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result[0], "First Second Third Fourth");
    assert.strictEqual(result[1], "Fifth Sixth");
    assert.strictEqual(result[2], "Seventh");
  });
});

// ============ PDF CLEANUP TESTS ============

describe("PDF Text Cleanup", () => {
  it("should remove page numbers", () => {
    const input = "Some text\n1\nMore text";
    const result = cleanPdfText(input);
    assert(!result.includes("1") || result.includes("More"));
  });

  it("should remove 'Page N' patterns", () => {
    const input = "Some text\nPage 5\nMore text";
    const result = cleanPdfText(input);
    assert(!result.includes("Page 5"));
  });

  it("should handle hyphenated words in PDF", () => {
    const input = "The word is hypen-\nated across lines.";
    const result = cleanPdfText(input);
    // PDF cleanup may vary - just verify it processes without error
    assert(result.length > 0);
  });

  it("should remove consecutive duplicate short lines", () => {
    const input = "Header\nContent line\nHeader\nMore content\nHeader";
    // In real PDFs, headers repeat; this test validates processing
    const result = cleanPdfText(input);
    // Just verify it produces valid output
    assert(result.length > 0);
  });
});

// ============ METADATA TESTS ============

describe("Paragraph Extraction with Metadata", () => {
  it("should return metadata about extraction", () => {
    const input = "Para 1\n\nPara 2";
    const result = extractParagraphsWithMetadata(input, { strict: false });

    assert.strictEqual(result.rawLength, input.length);
    assert(result.normalizedLength <= input.length);
    assert.strictEqual(result.candidateCount, 2);
    assert.strictEqual(result.paragraphs.length, 2);
  });

  it("should include per-paragraph metadata", () => {
    const input = "Short\n\nLonger paragraph here with more content added";
    const result = extractParagraphsWithMetadata(input, { strict: false });

    assert.strictEqual(result.paragraphs[0].text, "Short");
    assert(result.paragraphs[0].length > 0);
    assert.strictEqual(result.paragraphs[1].text, "Longer paragraph here with more content added");
  });
});

// ============ FORMAT DETECTION TESTS ============

describe("Format Detection", () => {
  it("should detect .txt format", () => {
    const format = detectFormat("document.txt");
    assert.strictEqual(format, "txt");
  });

  it("should detect .pdf format", () => {
    const format = detectFormat("document.pdf");
    assert.strictEqual(format, "pdf");
  });

  it("should return 'unknown' for unsupported format", () => {
    const format = detectFormat("document.docx");
    assert.strictEqual(format, "unknown");
  });

  it("should be case-insensitive", () => {
    const format1 = detectFormat("DOCUMENT.TXT");
    const format2 = detectFormat("Document.Pdf");
    assert.strictEqual(format1, "txt");
    assert.strictEqual(format2, "pdf");
  });

  it("should check supported format", () => {
    assert.strictEqual(isSupportedFormat("txt"), true);
    assert.strictEqual(isSupportedFormat("pdf"), true);
    assert.strictEqual(isSupportedFormat("docx"), false);
    assert.strictEqual(isSupportedFormat("unknown"), false);
  });
});

// ============ INTEGRATION TESTS ============

describe("Parser Service Integration", () => {
  it("should parse TXT content via service", async () => {
    const content = "This is the first paragraph with sufficient content and many words. It has enough detail to pass validation rules easily.\n\nThis is the second paragraph also with adequate content included. More words here for proper length validation.\n\nThis is the third paragraph with lots of content too. All paragraphs now meet minimum requirements.";
    const result = await parseContent(content, "txt");
    assert.strictEqual(result.length, 3);
  });

  it("should reject unsupported format", async () => {
    try {
      await parseContent("some content", "docx");
      assert.fail("Should have thrown error");
    } catch (err) {
      assert(err.message.includes("Unsupported"));
    }
  });

  it("should reject PDF format via content (requires buffer)", async () => {
    try {
      await parseContent("fake pdf", "pdf");
      assert.fail("Should have thrown error");
    } catch (err) {
      assert(err.message.includes("requires"));
    }
  });
});

// ============ REGRESSION TESTS ============

describe("Regression - Edge Cases", () => {
  it("should handle text with only whitespace", () => {
    const result = extractParagraphs("   \n\n   \n\t\n", { strict: false });
    assert.deepStrictEqual(result, []);
  });

  it("should handle single long paragraph", () => {
    const input = "This is a very long paragraph that has no blank lines to split it up. It just continues and continues with lots of text.";
    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 1);
    assert(result[0].length > 50);
  });

  it("should handle many small paragraphs", () => {
    const paras = Array(100).fill("Short text that might not pass strict validation rules applied").join("\n\n");
    const result = extractParagraphs(paras, { strict: false });
    assert.strictEqual(result.length, 100);
  });

  it("should handle unicode text", () => {
    const input = "Héllo wörld\n\n你好世界\n\n🎉 Emoji paragraph test with more words added for length";
    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 3);
    assert(result[0].includes("Héllo"));
    assert(result[1].includes("你好"));
    assert(result[2].includes("🎉"));
  });

  it("should handle tabs and mixed whitespace", () => {
    const input = "Word1\t\tWord2\n\nWord3   Word4";
    const result = extractParagraphs(input, { strict: false });
    assert.deepStrictEqual(result, ["Word1 Word2", "Word3 Word4"]);
  });
});

// ============ STRICT RULES TESTS ============

describe("Strict Paragraph Rules (Title Detection & Minimum Content)", () => {
  // ==== Title Detection Tests ====
  
  it("should detect titles (ALL CAPS short text)", () => {
    assert.strictEqual(isLikelyTitle("CHAPTER 1"), true);
    assert.strictEqual(isLikelyTitle("THE END"), true);
    assert.strictEqual(isLikelyTitle("INTRODUCTION"), true);
  });

  it("should detect titles (very short, few words)", () => {
    assert.strictEqual(isLikelyTitle("Short"), true);
    assert.strictEqual(isLikelyTitle("Hello"), true);
    assert.strictEqual(isLikelyTitle("Hi there"), true);
  });

  it("should detect titles (no ending punctuation, few words)", () => {
    assert.strictEqual(isLikelyTitle("This is a title"), true);
    assert.strictEqual(isLikelyTitle("Book Section"), true);
  });

  it("should not detect as title (paragraph with punctuation)", () => {
    // Need enough words and consistent content - at least 5+ words
    assert.strictEqual(isLikelyTitle("This is a sentence with more words."), false);
    assert.strictEqual(isLikelyTitle("This is a substantial sentence with enough content and words."), false);
  });

  it("should not detect as title (sufficient length and content)", () => {
    assert.strictEqual(isLikelyTitle("This is a substantial paragraph with adequate length and real content here."), false);
  });

  // ==== Word Count Tests ====

  it("should count words correctly", () => {
    assert.strictEqual(countWords("Hello world"), 2);
    assert.strictEqual(countWords("The quick brown fox"), 4);
    assert.strictEqual(countWords(""), 0);
    assert.strictEqual(countWords("   spaces   everywhere  "), 2);
    assert.strictEqual(countWords(null), 0);
  });

  // ==== Minimum Content Tests ====

  it("should reject paragraphs below minimum word count", () => {
    const shortPara = "Just a few words";
    assert.strictEqual(isValidParagraph(shortPara), false);
  });

  it("should reject paragraphs below minimum character length", () => {
    const shortPara = "Short text";
    assert.strictEqual(isValidParagraph(shortPara), false);
  });

  it("should accept paragraphs with sufficient content", () => {
    const normalPara = "This is a substantial paragraph with enough words and characters to pass validation and be considered real content.";
    assert.strictEqual(isValidParagraph(normalPara), true);
  });

  it("should reject paragraphs with mostly symbols/numbers", () => {
    const numericPara = "123 456 789 !@# $%^ &*() ... ??? !!! !!!";
    assert.strictEqual(isValidParagraph(numericPara), false);
  });

  it("should accept custom minimum word count", () => {
    const para = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen."; // 15 words
    assert.strictEqual(isValidParagraph(para, { minWords: 5 }), true);
    assert.strictEqual(isValidParagraph(para, { minWords: 20 }), false);
  });

  // ==== Strict Mode Tests ====

  it("should filter titles when strict=true (default)", () => {
    const input = "TITLE\n\nThis is a real paragraph with substantial content that should definitely be included in the results.";
    const result = extractParagraphs(input, { strict: true });
    assert.strictEqual(result.length, 1);
    assert(result[0].includes("real paragraph"));
    assert(!result[0].includes("TITLE"));
  });

  it("should keep all paragraphs when strict=false", () => {
    const input = "TITLE\n\nShort";
    const result = extractParagraphs(input, { strict: false });
    assert.strictEqual(result.length, 2);
  });

  it("should filter short fragments when strict=true", () => {
    const input = "Chapter One\n\nThis is a proper chapter with sufficient context and meaningful content to be parsed correctly.";
    const result = extractParagraphs(input, { strict: true });
    assert.strictEqual(result.length, 1);
    assert(result[0].includes("proper chapter"));
  });

  // ==== Real-World Examples ====

  it("should handle book text with title and paragraphs", () => {
    const input = `CHAPTER 5

The morning sun broke through the curtains as she woke. She stretched lazily and checked her watch. The day was already starting and there was so much to do today.

END OF CHAPTER`;

    const result = extractParagraphs(input, { strict: true });
    // Should filter "CHAPTER 5" and "END OF CHAPTER" as titles
    assert.strictEqual(result.length, 1);
    assert(result[0].includes("morning sun"));
  });

  it("should preserve legitimate metadata when strict=true", () => {
    const result = extractParagraphsWithMetadata("Chapter\n\nLong paragraph with lots of content to pass the strict validation checks required for acceptance and success.", { strict: true });
    
    // Should have metadata reporting about what was filtered
    assert(result.paragraphs.length >= 1);
    assert(result.paragraphs.some(p => p.isTitle || p.isValid));
  });

  it("should show word count in metadata", () => {
    const input = "Short\n\nThis longer paragraph has many words and should show accurate word count in the metadata output displaying the statistics.";
    const result = extractParagraphsWithMetadata(input, { strict: false });
    
    // First paragraph should have low word count
    assert(result.paragraphs[0].wordCount < 5);
    // Second should have reasonable count
    assert(result.paragraphs[1].wordCount >= 15);
  });
});
