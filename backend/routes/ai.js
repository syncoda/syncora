// import express from "express";
const express = require("express")
const ParagraphClassifierService =require("../aiservice/paragraphClassifier.js");

const router = express.Router();

router.post("/classify-paragraph", async (req, res, next) => {
  try {
    const { paragraph } = req.body;

    if (!paragraph || typeof paragraph !== "string") {
      return res.status(400).json({ error: "Request must include a paragraph string." });
    }

    const classifier = new ParagraphClassifierService(process.env.GROQ_API_KEY);
    const result = await classifier.classifyParagraph(paragraph);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
// export default router;

