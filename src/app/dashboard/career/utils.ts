import { ChatMessage, Lesson, Roadmap } from "./types";

export function createRoadmapMessage(
  roadmap: Roadmap
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "roadmap",
    roadmap,
  };
}

export function createLessonMessage(
  lesson: Lesson
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "lesson",
    lesson,
  };
}

export function createTextMessage(
  text: string
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    type: "text",
    text,
  };
}

export function createUserMessage(
  text: string
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    text,
  };
}