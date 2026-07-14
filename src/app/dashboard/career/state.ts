import { useState } from "react";
import { ChatMessage, Lesson, Roadmap } from "./types";
import {
  createLessonMessage,
  createRoadmapMessage,
  createUserMessage,
} from "./utils";

export function useCareerState() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  const [currentLesson, setCurrentLesson] =
    useState<Lesson | null>(null);

  const [loading, setLoading] = useState(false);

  function addUser(text: string) {
    setMessages((prev) => [
      ...prev,
      createUserMessage(text),
    ]);
  }

  function showRoadmap(data: Roadmap) {
    setRoadmap(data);

    setMessages((prev) => [
      ...prev,
      createRoadmapMessage(data),
    ]);
  }

  function showLesson(data: Lesson) {
    setCurrentLesson(data);

    setMessages((prev) => [
      ...prev,
      createLessonMessage(data),
    ]);
  }

  return {
    messages,
    setMessages,

    roadmap,
    setRoadmap,

    currentLesson,
    setCurrentLesson,

    loading,
    setLoading,

    addUser,
    showRoadmap,
    showLesson,
  };
}