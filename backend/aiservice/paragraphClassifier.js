const Groq  =  require('groq-sdk');
const EMOTIONS  = require('../config/emotions.js');

class ParagraphClassifierService {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("Missing Groq API key. Set GROQ_API_KEY in environment variables.");
    }
    this.client = new Groq({ apiKey });
  }

  async classifyParagraph(paragraph) {
    if (!paragraph || typeof paragraph !== "string") {
      throw new Error("Paragraph must be a non-empty string.");
    }

    const normalizedCategories = EMOTIONS.map((value) => String(value).trim()).filter(Boolean);
    if (normalizedCategories.length === 0) {
      throw new Error("Categories must contain at least one valid string.");
    }

    const prompt = `You are a paragraph classifier. Choose the one category from the list that best matches the meaning and tone of the paragraph.

Categories:\n${JSON.stringify(normalizedCategories)}\n
Paragraph:\n"""${paragraph.trim()}"""

Return only a valid JSON object with the following shape:\n{
  "category": "<one of the provided categories>",
  "confidence": <number between 0 and 1>
}

Do not return any additional text.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are a helpful classifier that selects the best matching category from a given list."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from the classification model.");
      }

      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      if (!parsed || typeof parsed.category !== "string") {
        throw new Error("Invalid classifier response format.");
      }

      return {
        category: parsed.category,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    } catch (error) {
      throw new Error(`Paragraph classification failed: ${error.message}`);
    }
  }
}

module.exports  = ParagraphClassifierService;
