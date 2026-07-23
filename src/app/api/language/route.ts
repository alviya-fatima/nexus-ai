import { GoogleGenAI } from "@google/genai";
import { saveMemory, getUserProfileFacts } from "@/app/lib/supermemory";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

function cleanJson(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode ?? "start";

    // ---------------------------------------------------------
    // MODE 1: Start learning a language — generate the full
    // lesson roadmap + Lesson 1's vocabulary content
    // ---------------------------------------------------------
    if (mode === "start") {
      const { language, userId } = body as {
        language: string;
        userId?: string;
      };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, language);
        if (facts.length > 0) {
          memoryContext = `\n\nWhat you remember about this learner from past sessions:\n${facts
            .map((f) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const prompt = `
You are NEXUS AI, a friendly, encouraging language tutor building a complete beginner-to-fluent lesson roadmap for someone learning ${language}.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "goal": "string",
  "langCode": "string",
  "roadmap": ["string", "string", "..."],
  "lesson": {
    "title": "string",
    "overview": "string",
    "words": [
      {
        "word": "string",
        "pronunciation": "string",
        "meaning": "string",
        "usageExample": "string"
      }
    ]
  }
}

Rules:
- goal = phrased clearly, with 1 emoji, e.g. "Learn conversational Spanish 🇪🇸".
- langCode = the correct BCP-47 language code for speech synthesis, e.g. "es-ES" for Spanish, "fr-FR" for French, "ja-JP" for Japanese.
- roadmap = the FULL beginner-to-fluent lesson journey (typically 10-16 lessons), each a descriptive phrase (8-14 words) covering one clear theme (greetings, numbers, food, past tense, etc.), in logical learning order.
- lesson = the FULL content for Lesson 1 ONLY.
- overview: 2-3 sentences introducing what this lesson covers and why it's a good starting point.
- words: 6-10 vocabulary words/phrases for this lesson. For each: "word" is the word written in the target language's native script, "pronunciation" is a simple phonetic spelling a beginner can sound out (not IPA, plain phonetic like "oh-la"), "meaning" is the English translation, "usageExample" is one short natural example sentence in the target language followed by its English translation in parentheses.
- Never teach lesson 2 or later.
- Never return anything except the JSON object.
${memoryContext}

Language the person wants to learn: ${language}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User started learning ${language}. Goal: "${parsed.goal}".`,
          { type: "language_started", language }
        );
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 2: Generate a specific lesson's vocabulary content
    // ---------------------------------------------------------
    if (mode === "lesson") {
      const { goal, roadmap, lessonIndex, userId } = body as {
        goal: string;
        roadmap: string[];
        lessonIndex: number;
        userId?: string;
      };
      const lessonTitle = roadmap[lessonIndex];

      const prompt = `
You are NEXUS AI, a language tutor teaching a step-by-step lesson roadmap.

Overall goal: ${goal}
Full roadmap: ${JSON.stringify(roadmap)}
The learner just finished all previous lessons and is now starting:
Lesson ${lessonIndex + 1}: "${lessonTitle}"

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "title": "string",
  "overview": "string",
  "words": [
    {
      "word": "string",
      "pronunciation": "string",
      "meaning": "string",
      "usageExample": "string"
    }
  ]
}

Rules:
- This must cover ONLY Lesson ${lessonIndex + 1} ("${lessonTitle}").
- overview: 2-3 sentences introducing what this lesson covers.
- words: 6-10 vocabulary words/phrases. For each: "word" in the target language's native script, "pronunciation" as simple phonetic spelling, "meaning" as the English translation, "usageExample" as one natural example sentence in the target language plus its English translation in parentheses.
- Never reference or teach any other lesson.
- Never return anything except the JSON object.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const lesson = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User advanced to lesson "${lessonTitle}" toward the goal "${goal}".`,
          { type: "language_progress" }
        );
      }

      return Response.json({ lesson });
    }

    // ---------------------------------------------------------
    // MODE 3: Answer a question about the current lesson
    // ---------------------------------------------------------
    if (mode === "question") {
      const { lessonTitle, question, userId } = body as {
        lessonTitle: string;
        question: string;
        userId?: string;
      };

      const prompt = `
You are NEXUS AI, a language tutor.

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "reply": "string"
}

Rules:
- The learner is currently on this lesson: "${lessonTitle}"
- Answer ONLY the learner's question below, in the context of this lesson.
- Keep the reply focused, practical, and friendly, with a light touch of emojis (1-2 max).

Question: ${question}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `Q: ${question}\nA: ${parsed.reply}`,
          { type: "language_qa", lessonTitle }
        );
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 4: Generate a Duolingo-style mixed-format quiz
    // ---------------------------------------------------------
    if (mode === "quiz") {
      const { lessonTitle, words, userId } = body as {
        lessonTitle: string;
        words: { word: string; pronunciation: string; meaning: string; usageExample: string }[];
        userId?: string;
      };

      const prompt = `
You are NEXUS AI, a language tutor creating an intense, Duolingo-style test for this lesson: "${lessonTitle}"

Vocabulary taught in this lesson:
${JSON.stringify(words)}

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string"
    },
    {
      "type": "translate_to_target",
      "prompt": "string",
      "correctAnswer": "string",
      "explanation": "string"
    },
    {
      "type": "translate_to_english",
      "prompt": "string",
      "correctAnswer": "string",
      "explanation": "string"
    },
    {
      "type": "listening",
      "prompt": "string",
      "speakText": "string",
      "correctAnswer": "string",
      "explanation": "string"
    },
    {
      "type": "word_bank",
      "prompt": "string",
      "wordBank": ["string", "string", "string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}

Rules:
- Generate exactly 10 questions, mixing ALL 5 types above, drawn from and testing the vocabulary above thoroughly and rigorously — like a real Duolingo unit test, not a casual quiz.
- "multiple_choice": prompt asks for the meaning/translation of a word; 4 options, one correct.
- "translate_to_target": prompt gives an English word/phrase from the lesson; correctAnswer is the target-language word/phrase (accept the exact word taught).
- "translate_to_english": prompt gives a target-language word/phrase; correctAnswer is the English meaning.
- "listening": speakText is a word/phrase from the lesson to be spoken aloud (via TTS); prompt instructs the learner to type what they hear; correctAnswer matches speakText exactly.
- "word_bank": prompt is a short sentence-building instruction (e.g. "Build the sentence: I eat bread"); wordBank has 6 shuffled words/pieces (including 1-2 decoy words not needed) that can build correctAnswer (the exact target-language sentence, words separated by spaces) using only some of the bank.
- Every correctAnswer must be an exact, unambiguous string so it can be checked programmatically (case-insensitive, trimmed).
- explanation: 1 short sentence explaining the correct answer.
- Order questions so difficulty escalates and types are well mixed, not grouped.
- Never return anything except the JSON object.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `User took an intense Duolingo-style quiz for the lesson "${lessonTitle}".`,
          { type: "language_quiz" }
        );
      }

      return Response.json(parsed);
    }

    return Response.json({ error: "Unknown mode." }, { status: 400 });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}