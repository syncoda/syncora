const OpenAI = require('openai');

// /d:/ado's project/backend/aiservice/emotiondetector.js


class EmotionDetectorService {
    constructor(apiKey) {
        this.client = new OpenAI({ apiKey });
    }

    async detectEmotions(paragraph) {
        const prompt = `Analyze the following paragraph and detect the emotions expressed. 
Return a JSON object with emotion names as keys and intensity (0-1) as values.

Paragraph: "${paragraph}"

Respond only with the JSON object, no other text.`;

        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an emotion detection assistant. Return emotions as JSON with intensity values between 0 and 1.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const result = completion.choices[0].message.content;
            return JSON.parse(result);
        } catch (error) {
            throw new Error(`Emotion detection failed: ${error.message}`);
        }
    }
}

module.exports = EmotionDetectorService;