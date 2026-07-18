import { GoogleGenAI } from "@google/genai";
import { saveMemory, getUserProfileFacts } from "../../../../lib/supermemory";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

function cleanJson(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

type HistoryTurn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode ?? "chat";

    // ---------------------------------------------------------
    // MODE 1: Free-flowing voice conversation (feelings, problems,
    // projects, anything) — remembers across sessions via Supermemory
    // ---------------------------------------------------------
    if (mode === "chat") {
      const { message, userId, history } = body as {
        message: string;
        userId?: string;
        history?: HistoryTurn[];
      };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, message);
        if (facts.length > 0) {
          memoryContext = `\n\nWhat you remember about this person from past conversations (use naturally, don't force it in):\n${facts
            .map((f: string) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const historyText =
        history && history.length > 0
          ? `\n\nRecent conversation so far:\n${history
              .map((h) => `${h.role === "user" ? "Person" : "You"}: ${h.text}`)
              .join("\n")}`
          : "";

      const prompt = `
You are NEXUS AI, a warm, emotionally attuned companion having a real-time VOICE conversation with someone. This is spoken aloud, not read as text, so:
- Speak naturally, like a real conversation — no markdown, no bullet lists, no headers, no asterisks.
- Keep responses fairly short (2-5 sentences) unless the person clearly wants a longer, deeper answer.
- The person might want to vent about feelings, talk through a problem, discuss a project, or just chat.
- If the person asks you to run a mock interview, tell them warmly that you'll need their resume details, the role they're interviewing for, and their experience level first, and that they can fill that in using the "Start Mock Interview" panel to begin.
${memoryContext}${historyText}

Respond with ONLY valid JSON, no markdown, no code fences:

{
  "reply": "string"
}

The person just said: ${message}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const parsed = JSON.parse(cleanJson(response.text ?? ""));

      if (userId) {
        void saveMemory(
          userId,
          `Person said: "${message}". NEXUS AI replied: "${parsed.reply}".`,
          { type: "companion_chat" }
        );
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 2: Start a mock interview — generate a tailored set
    // of interview questions from resume + role + experience
    // ---------------------------------------------------------
    if (mode === "interview_start") {
      const { resumeText, role, experienceLevel, userId } = body as {
        resumeText: string;
        role: string;
        experienceLevel: string;
        userId?: string;
      };

      let memoryContext = "";
      if (userId) {
        const facts = await getUserProfileFacts(userId, role);
        if (facts.length > 0) {
          memoryContext = `\n\nWhat you remember about this person from past sessions:\n${facts
            .map((f: string) => `- ${f}`)
            .join("\n")}`;
        }
      }

      const prompt = `
You are NEXUS AI, an industrial-grade mock interviewer conducting a realistic voice interview.

Candidate's resume / background:
${resumeText}

Role they're interviewing for: ${role}
Their experience level: ${experienceLevel}
${memoryContext}

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "introMessage": "string",
  "questions": ["string", "string", "..."]
}

Rules:
- introMessage: a short, professional, spoken opening (2-4 sentences) welcoming the candidate and explaining briefly how the interview will run. This will be spoken aloud.
- questions: 6-8 realistic interview questions tailored specifically to their resume, the role, and their experience level. Mix behavioral questions (about past experience, teamwork, challenges) with role-specific technical or situational questions appropriate to their level. Order them from warm-up to more challenging.
- Each question should be phrased exactly as an interviewer would say it out loud — natural spoken phrasing, no numbering, no markdown.
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
          `Person started a mock interview for the role of "${role}" at "${experienceLevel}" level.`,
          { type: "interview_started", role }
        );
      }

      return Response.json(parsed);
    }

    // ---------------------------------------------------------
    // MODE 3: Generate the full post-interview report
    // ---------------------------------------------------------
    if (mode === "interview_report") {
      const { role, transcript, userId } = body as {
        role: string;
        transcript: { question: string; answer: string }[];
        userId?: string;
      };

      const transcriptText = transcript
        .map(
          (t, i) =>
            `Q${i + 1}: ${t.question}\nCandidate's answer: ${
              t.answer || "(no answer given)"
            }`
        )
        .join("\n\n");

      const prompt = `
You are NEXUS AI, an industrial-grade interview assessor reviewing a completed mock interview for the role of "${role}".

Full transcript:
${transcriptText}

You MUST reply ONLY with valid JSON. No markdown. No \`\`\`json. No explanations.

Return ONLY this structure:

{
  "overallScore": number,
  "overallSummary": "string",
  "strengths": ["string", "string"],
  "areasToImprove": ["string", "string"],
  "perQuestion": [
    {
      "question": "string",
      "whatItAssessed": "string",
      "howYouAnswered": "string",
      "feedback": "string"
    }
  ]
}

Rules:
- overallScore: an honest score from 0-100 reflecting real interview readiness for this role — do not inflate it.
- overallSummary: 3-5 full sentences giving a candid, constructive overall assessment.
- strengths: 2-4 genuine strengths shown across the answers.
- areasToImprove: 2-4 concrete, specific areas to work on.
- perQuestion: one entry per question in the transcript, in order. "whatItAssessed" explains what skill/trait the question was probing for. "howYouAnswered" is a brief honest summary of their actual answer. "feedback" is specific, constructive, and actionable — praise what worked, name what didn't.
- Be honest and rigorous like a real hiring panel would be, but constructive and encouraging in tone — this should help the person improve, not just judge them.
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
          `Person completed a mock interview for "${role}". Overall score: ${parsed.overallScore}/100. Summary: ${parsed.overallSummary}`,
          { type: "interview_completed", role }
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