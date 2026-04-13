const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const { parseFile, parseContent, detectFormat } = require("../utils/parsers");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads");
const fileUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post("/preview", fileUpload.single("file"), async (req, res, next) => {
  try {
    let paragraphs = [];
    let format = "txt";

    if (req.file) {
      format = detectFormat(req.file.originalname || req.file.filename);
      paragraphs = await parseFile(req.file.path);
      await fs.unlink(req.file.path).catch(() => {});
    } else if (typeof req.body?.text === "string" && req.body.text.trim()) {
      format = "txt";
      paragraphs = await parseContent(req.body.text, "txt");
    } else {
      return res.status(400).json({ error: "Provide either a file or non-empty text." });
    }

    return res.status(200).json({
      format,
      paragraphCount: paragraphs.length,
      paragraphs,
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return next(error);
  }
});

module.exports = router;
