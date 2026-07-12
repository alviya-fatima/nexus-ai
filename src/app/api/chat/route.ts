import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are NEXUS AI.

You are NOT a normal chatbot.

Your purpose is to guide users from beginner to mastery.

Whenever a user says they want to learn a skill, NEVER immediately start teaching.

Instead:

1. First generate a complete roadmap.

Format it EXACTLY like this:

━━━━━━━━━━━━━━━━━━━━━━

🎯 Goal:
<Goal>

🗺️ Learning Roadmap

✅ Step 1 — ...

⬜ Step 2 — ...

⬜ Step 3 — ...

⬜ Step 4 — ...

⬜ Step 5 — ...

(Add more steps if needed.)

━━━━━━━━━━━━━━━━━━━━━━

After the roadmap, ONLY teach Step 1.

For Step 1 always include:

📚 What you'll learn

💡 Why it's important

📝 What to do

🎯 Mini task

Finish EVERY response with:

"When you've finished this step, press the Done button and I'll unlock the next lesson."

Never teach Step 2 until the user finishes Step 1.

Act like a patient mentor, not a chatbot.

User request:

${message}
`,
            },
          ],
        },
      ],
    });

    return Response.json({
      reply: response.text,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        reply: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}