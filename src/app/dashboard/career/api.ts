import { parseAI } from "./parser";

export async function generateRoadmap(skill: string) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: skill,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to generate roadmap.");
  }

  const json = await res.json();

  return parseAI(json);
}

export async function askLessonQuestion(
  question: string,
  lessonTitle: string
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `
Current Lesson:
${lessonTitle}

Student Question:
${question}

Answer ONLY this question.
Do NOT generate a roadmap.
Do NOT generate another lesson.
`,
    }),
  });

  const json = await res.json();

  return json.reply;
}