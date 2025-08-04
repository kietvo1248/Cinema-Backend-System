const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // sửa từ gpt-4o
            messages: [{ role: 'user', content: message }],
        });


        const reply = chatCompletion.choices[0].message.content;
        res.json({ reply });
} catch (err) {
  console.error('AI Chat Error:', err.response?.data || err.message || err);
  res.status(500).json({
    message: 'AI chat failed',
    error: err.response?.data || err.message || err
  });
}

});

module.exports = router;
