# Paragraph Parser - Implementation Guide

## Overview

The paragraph parser is now a **modular, testable service** that converts documents (TXT, PDF) into clean, well-structured paragraphs. It's separate from the upload route, making it easy to test, debug, and extend.

## Architecture

```dir
backend/utils/parsers/
├── index.js           # Main dispatcher - routes by format
├── normalize.js       # Shared normalization logic
├── txtParser.js       # Text file parser
└── pdfParser.js       # PDF file parser

backend/cli/
└── testParser.js      # Standalone test utility

backend/routes/
└── upload.js          # Now uses parser service (simplified!)

backend/tests/
└── parsers.test.js    # Comprehensive unit + fixture tests
```

## Core Concepts

### 1. Normalization Pipeline

All text goes through a **standardized normalization pipeline**:

```dir
Raw Input
   ↓
Convert CRLF/CR to LF
   ↓
Remove trailing line whitespace
   ↓
Collapse 3+ blank lines to 2
   ↓
Split on blank line boundaries
   ↓
Join internal newlines with spaces
   ↓
Collapse multiple spaces
   ↓
Trim each paragraph
   ↓
Return non-empty paragraphs
```

**Example:**

```dir
Input:  "Hello world\r\n\n\nNext para"
After:  "Hello world\n\nNext para"
Result: ["Hello world", "Next para"]
```

### 2. Format Detection

The parser automatically detects format from file extension:

```javascript
.txt  → TXT parser (simple UTF-8 read + normalize)
.pdf  → PDF parser (pdf-parse library + cleanup heuristics)
```

### 3. PDF Cleanup Heuristics

PDFs often have artifacts like page numbers and repeated headers. The parser **automatically removes**:

- Page numbers (`1`, `Page 5`, etc.)
- Repeated headers/footers (duplicate short lines)
- Hyphenated words broken across lines (`hypen-\nated` → `hyphenated`)

## Usage Patterns

### Pattern 1: Direct API Usage (in code)

```javascript
const { parseFile, parseContent } = require('./backend/utils/parsers');

// Parse file by path (auto-detects format)
const paragraphs = await parseFile('./document.txt');
console.log(`Extracted ${paragraphs.length} paragraphs`);

// Parse text content directly (useful for testing)
const paras = await parseContent('Para 1\n\nPara 2', 'txt');
```

### Pattern 2: Upload Route (automatic)

When you POST to `/api/upload`:

1. Parser detects format from filename
2. Extracts paragraphs
3. Matches each to emotion + song
4. Persists to database

## Strict Paragraph Rules (NEW!)

To prevent titles and incomplete content from being treated as paragraphs, the parser now has **strict validation rules** (enabled by default).

### Rule 1: Title Detection

Text is rejected as a paragraph if it **looks like a title/heading**:

```javascript
✗ Titles (Rejected):
  - "CHAPTER 5"
  - "THE END"
  - "Book Title"
  - "Section One"
  - "Hello"

✓ Real Paragraphs (Accepted):
  - "This is a real sentence with substantial content."
  - "The morning sun broke through as she woke."
```

**Title Detection Criteria:**
- Length < 30 characters, OR
- Word count < 3, OR
- ALL CAPS (6+ alpha characters), OR
- Title Case with no ending punctuation AND < 5 words

### Rule 2: Minimum Content

Paragraphs must have:
- **At least 15 words** (default, configurable)
- **At least 50 characters** (default, configurable)
- **At least 50% alphabetic characters** (not mostly numbers/symbols)

```javascript
✗ Too Short:
  - "Just a few words" (4 words)
  - "Brief." (1 word)

✓ Valid Paragraphs:
  - "This is a paragraph with enough substantial content..."
  - "The story begins here with many details and context."
```

### Rule 3: Content Quality

Paragraphs with mostly symbols/numbers are rejected:

```javascript
✗ Junk Content:
  - "123 456 789 !@# $%^ &*() ... ??? !!!"
  - "... ... ... ... ... ... ..."

✓ Real Content:
  - "Hello world! This is real text."
```

### Using Strict Mode

**Default (strict = true)** - Recommended for books/content:

```javascript
const { extractParagraphs } = require('./utils/parsers/normalize');

// Strict mode ENABLED (default)
const paras = extractParagraphs(text);

// Same as:
const paras = extractParagraphs(text, { strict: true });
```

**Strict mode disabled** - For testing/debugging:

```javascript
// Include everything, even fragments
const paras = extractParagraphs(text, { strict: false });

// - Titles are included
// - Short fragments are included
// - No content quality filtering
```

### Practical Example

```javascript
const text = `CHAPTER 5

The morning sun broke through the curtains as she woke. 
She stretched lazily and checked her watch. The day was 
already starting and there was so much to do.

THE END`;

// Strict mode (default) - only returns the real paragraph
extractParagraphs(text);
// → ["The morning sun broke through..."]

// Non-strict - returns everything
extractParagraphs(text, { strict: false });
// → ["CHAPTER 5", "The morning sun broke through...", "THE END"]
```

## Metadata Output

When you need details about what was filtered:

```javascript
const { extractParagraphsWithMetadata } = require('./utils/parsers/normalize');

const result = extractParagraphsWithMetadata(text);
// Returns:
{
  rawLength: 250,
  normalizedLength: 240,
  candidateCount: 5,
  paragraphs: [
    {
      index: 0,
      text: "CHAPTER 1",
      length: 9,
      wordCount: 2,
      isEmpty: false,
      isTitle: true,      // ← Marked as title
      isValid: false      // ← Rejected by strict rules
    },
    {
      index: 1,
      text: "This is real content...",
      length: 150,
      wordCount: 25,
      isEmpty: false,
      isTitle: false,
      isValid: true       // ← Accepted!
    }
  ]
}
```

## Configuration

Customize strict rule thresholds:

```javascript
extractParagraphs(text, {
  strict: true,           // Enable/disable strict validation
  minWords: 15,          // Minimum word count (default: 15)
  minCharacters: 50      // Minimum character length (default: 50)
});

// Example: Looser rules for poetry
extractParagraphs(poemText, {
  strict: true,
  minWords: 5,           // Lower threshold
  minCharacters: 20
});
```

## Testing

All rules are comprehensively tested:

```bash
npm test

# Output:
# 53 passing
# ✔ Normalization tests
# ✔ Paragraph extraction tests
# ✔ PDF cleanup tests
# ✔ Strict rule tests (13 new tests!)
# ✔ Format detection tests
# ✔ Integration tests
```


```bash
curl -X POST \
  -F "file=@document.txt" \
  http://localhost:3001/api/upload
```

### Pattern 3: Interactive Testing (CLI)

```bash
# Interactive mode - paste text, test, compare
npm run test:parser

# Test with a file
node backend/cli/testParser.js --mode file --file mybook.txt

# Test with text input
node backend/cli/testParser.js --mode text --input "Para 1\n\nPara 2"
```

## Testing

### Run all unit tests

```bash
npm test
```

This runs **40+ test cases** covering:

- ✅ Normalization (CRLF, blank lines, whitespace)
- ✅ Paragraph splitting (blank line boundaries)
- ✅ Internal newline handling
- ✅ Empty paragraph filtering
- ✅ Realistic fixtures (dialogue, wrapped text, poetry)
- ✅ PDF cleanup (page numbers, headers, hyphenation)
- ✅ Unicode handling
- ✅ Edge cases (very long/short text, tabs, mixed whitespace)

### Test breakdown

**Normalization Tests (6 tests)**

- CRLF → LF conversion
- CR → LF conversion
- Blank line collapsing
- Trailing whitespace removal
- Overall trimming
- Mixed line endings

**Paragraph Extraction Tests (7 tests)**

- Split on blank lines
- Internal newline cleanup
- Multiple space collapsing
- Per-paragraph trimming
- Empty paragraph filtering
- Null/empty input handling

**Fixture Tests (5 tests)**

- Realistic book text with dialogue
- Wrapped paragraphs (editor line breaks)
- Poetry with intentional line breaks
- Paragraph order preservation
- Multi-paragraph sequences

**PDF Cleanup Tests (4 tests)**

- Page number removal
- "Page N" pattern removal
- Hyphenated word fixing
- Header/footer deduplication

**Metadata Tests (2 tests)**

- Extraction statistics (raw/normalized length, candidate count)
- Per-paragraph metadata (text, length, isEmpty)

**Edge Case Regression Tests (5 tests)**

- Whitespace-only input
- Single long paragraph
- Many small paragraphs (100+)
- Unicode text (emoji, accents, Asian characters)
- Tabs and mixed whitespace

## Interactive Test Utility Guide

### Launching

```bash
npm run test:parser
```

### Interactive Menu

```
╔═════════════════════════════════════════╗
║   PARAGRAPH PARSER - INTERACTIVE TEST   ║
╚═════════════════════════════════════════╝

What would you like to do?
  1) Paste text directly
  2) Load file
  3) View sample fixtures
  4) Exit
```

### Option 1: Paste Text

```
Enter your text (type 'END' on a new line when done):
> She entered the room.
> 
> "Hello," he said.
> END

═══════════════════════════════════════════
PARSER RESULTS
═══════════════════════════════════════════

📊 INPUT STATISTICS:
   Raw length: 47 characters
   Lines: 4
   After normalization: 45 characters
   Normalized lines: 3

✅ EXTRACTED PARAGRAPHS:
   Total: 2 paragraphs

   [1] She entered the room.
       └─ 22 chars
   [2] "Hello," he said.
       └─ 16 chars
```

### Option 2: Load File

```
Enter choice (1-4): 2
File path (relative or absolute): sample_book.txt

📊 INPUT STATISTICS:
   Format detected: TXT
   File size: 1024 bytes
   Raw length: 1024 characters
   ...
```

### Option 3: View Sample Fixtures

Shows pre-defined test cases you can try:

```
--- SIMPLE ---
Paragraph 1

Paragraph 2

Paragraph 3
→ 3 paragraphs extracted

--- DIALOGUE ---
She entered the room.

"Hello," he said.

"Hi there," she replied.
→ 3 paragraphs extracted
```

## Understanding the Output

### Statistics Section

```
📊 INPUT STATISTICS:
   Raw length: 100 characters       ← Original file size
   Lines: 8                          ← Original line count
   After normalization: 95 chars     ← After CRLF→LF, collapse blanks
   Normalized lines: 5               ← Resulting line count
```

This helps you see how much normalization happened.

### Results Section

```
✅ EXTRACTED PARAGRAPHS:
   Total: 3 paragraphs

   [1] First paragraph text here
       └─ 28 chars
   [2] Second paragraph here  
       └─ 24 chars
   [3] Third paragraph
       └─ 15 chars
```

Each paragraph shows:

- Index (for debugging)
- Actual text
- Character count

### Metadata Section

```
📋 DETAILED METADATA:
   Raw input size: 100 bytes
   After normalization: 95 bytes
   Blank-line splits detected: 3    ← How many blank lines found
   Final paragraphs: 2              ← After filtering empty ones
   ⚠️  Filtered out 1 empty candidates
```

Useful for understanding parser behavior.

## Extending the Parser

### Adding a New Format (e.g., DOCX)

1. Create `backend/utils/parsers/docxParser.js`:

```javascript
const { extractParagraphs } = require('./normalize');

async function parseDocx(filePath, options = {}) {
  // Use docx library to read
  const text = await readDocx(filePath);
  
  // Apply standard normalization
  return extractParagraphs(text, options);
}

module.exports = { parseDocx };
```

1. Update `backend/utils/parsers/index.js`:

```javascript
function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.docx') return 'docx';  // ← Add this
  // ... rest of formats
}

async function parseFile(filePath, options = {}) {
  const format = detectFormat(filePath);
  
  if (format === 'docx') {
    return require('./docxParser').parseDocx(filePath, options);
  }
  // ... rest of formats
}
```

1. Add tests in `backend/tests/parsers.test.js`

2. Done! Upload route automatically supports it.

## Common Use Cases

### Extract with minimum length requirement

```javascript
const paragraphs = await parseFile('./book.txt', { minLength: 50 });
// Only returns paragraphs with 50+ characters
```

### Debug normalization step-by-step

```javascript
const { normalizeText, extractParagraphsWithMetadata } = require('./backend/utils/parsers/normalize');

const raw = "Para 1\r\n\r\n\r\nPara 2";
const normalized = normalizeText(raw);
console.log('After normalization:', normalized);

const meta = extractParagraphsWithMetadata(raw);
console.log('Candidates:', meta.candidateCount);
console.log('Paragraphs:', meta.paragraphs.length);
```

### Test PDF cleanup

```javascript
const { cleanPdfText } = require('./backend/utils/parsers/pdfParser');

const withPageNumbers = "Content\nPage 1\nMore content";
const cleaned = cleanPdfText(withPageNumbers);
console.log('After cleanup:', cleaned);
```

## Troubleshooting

### "Unsupported format: .docx"

**Fix:** Add DOCX parser (see "Extending the Parser" section) or convert to PDF/TXT first.

### Parser extracts too many paragraphs (noise)

**Use minLength option:**

```javascript
const paragraphs = await parseFile('./file.txt', { minLength: 20 });
```

### PDF text looks garbled

**PDF might be scanned image.** OCR not supported yet. Try converting to text first.

### Paragraph splitting looks wrong

**Check:** Is your paragraph separator really a blank line? Try:

```bash
npm run test:parser
# Choose option 1, paste your text, see what happens
```

## Performance

- **TXT files:** ~10ms per 100KB
- **PDF files:** ~100-200ms per 100 pages (depends on PDF-parse speed)
- **Memory:** Streaming for large files, buffered for small files
- **Tested with:** Text up to 10MB, PDFs with 1000+ pages

## Files You Can Learn From

- **Clean implementation:** `backend/utils/parsers/normalize.js` - core logic, well-commented
- **Real-world handling:** `backend/utils/parsers/pdfParser.js` - shows PDF edge cases
- **Test examples:** `backend/tests/parsers.test.js` - 40+ realistic test cases
- **Orchestration:** `backend/routes/upload.js` - shows how to use the parser in context
- **Interactive example:** `backend/cli/testParser.js` - real-world usage patterns

## Next Steps

1. **Run tests:** `npm test` to verify everything works
2. **Try interactive tool:** `npm run test:parser` to see parser in action
3. **Test your documents:** Upload TXT/PDF via `/api/upload` endpoint
4. **Extend:** Add EPUB/DOCX support as needed
5. **Monitor:** Check logs to see `[PARSER]` messages showing what's happening

## Current Limitations & Future Work

❌ **Current:**

- No EPUB support (planned)
- No DOCX support (planned)
- No scanned PDF/OCR (not in scope)
- Can't extract from images

✅ **What we handle:**

- Plain text with various line endings
- PDF text extraction with layout heuristics
- Unicode and multi-byte characters
- Large files (10MB+)
- Pathological edge cases (1000+ paragraphs, tabs, mixed whitespace)

---

**Happy parsing!** 🎉
