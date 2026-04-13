const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const { all, run } = require("../db/db");
const { parseFile } = require("../utils/parsers");
const { inferEmotion, pickMatchingSong } = require("../utils/content");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads");
const fileUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function getOriginalTitle(originalName) {
  return path.parse(originalName).name.replace(/[_.]+/g, " ").trim() || "Untitled";
}

/**
 * POST /api/upload
 * Upload a document (TXT or PDF) and extract paragraphs
 *
 * The upload route orchestrates the full process:
 * 1. Receive file via multipart/form-data
 * 2. Use parser service to extract paragraphs (handles format detection)
 * 3. Match each paragraph to an emotion and song
 * 4. Persist to database
 * 5. Clean up temporary file
 */
router.post("/upload", fileUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      console.warn(`[UPLOAD] Request rejected: file upload field missing. Please attach a file.`);
      return res.status(400).json({ error: "A file is required." });
    }

    console.log(
      `[UPLOAD] Received file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(0)}KB)`
    );

    // Use parser service to extract paragraphs
    // Parser service handles format detection, text extraction, and normalization
    let paragraphs;
    try {
      paragraphs = await parseFile(req.file.path);
    } catch (parseError) {
      await fs.unlink(req.file.path).catch(() => {});

      // Provide user-friendly error based on parse error type
      const isFormatError = parseError.message.includes("Unsupported");
      const statusCode = isFormatError ? 415 : 400;
      const errorMsg = isFormatError
        ? `Only .txt and .pdf files are supported right now.`
        : `Failed to parse file: ${parseError.message}`;

      console.warn(`[UPLOAD] Parsing failed: ${errorMsg}`);
      return res.status(statusCode).json({ error: errorMsg });
    }

    console.log(
      `[UPLOAD] Parsed: ${paragraphs.length} paragraphs extracted from ${req.file.originalname}`
    );

    if (paragraphs.length === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      console.warn(
        `[UPLOAD] Processing failed: ${req.file.originalname} contains no readable paragraphs. File may be empty or unreadable.`
      );
      return res.status(400).json({ error: "No paragraphs were found in the uploaded file." });
    }

    // Prepare metadata
    const title = getOriginalTitle(req.file.originalname);
    const now = new Date().toISOString();
    const bookId = uuid();
    const songs = await all("SELECT id, title, artist, emotion, filePath, duration FROM songs");

    // Create book entry
    await run(
      "INSERT INTO books (id, title, fileName, totalParagraphs, createdAt) VALUES (?, ?, ?, ?, ?)",
      [bookId, title, req.file.originalname, paragraphs.length, now]
    );

    console.log(`[UPLOAD] Book created: "${title}" with ${paragraphs.length} paragraphs`);

    // Process each paragraph: infer emotion, match song, persist
    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraphText = paragraphs[index];
      const detected = inferEmotion(paragraphText);
      const matchedSong = pickMatchingSong(songs, detected.emotion);

      await run(
        `INSERT INTO paragraphs (id, bookId, "index", text, emotion, confidence, songId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          bookId,
          index,
          paragraphText,
          detected.emotion,
          detected.confidence,
          matchedSong ? matchedSong.id : null,
        ]
      );
    }

    // Clean up temporary upload file
    await fs.unlink(req.file.path).catch(() => {});

    console.log(
      `[UPLOAD] Processing completed successfully: ${paragraphs.length} paragraphs parsed and stored.`
    );

    return res.status(201).json({
      bookId,
      title,
      fileName: req.file.originalname,
      totalParagraphs: paragraphs.length,
    });
  } catch (error) {
    console.error(`[ERROR] POST /api/upload: ${error.message}`);

    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    return next(error);
  }
});

module.exports = router;