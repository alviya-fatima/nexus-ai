import { Lesson, Roadmap } from "./types";

export type AIResponse = {
  roadmap: Roadmap;
  lesson: Lesson;
};

export function parseAI(data: any): AIResponse {
  return {
    roadmap: {
      goal: data.goal,
      roadmap: data.roadmap ?? [],
    },

    lesson: {
      step: 1,
      title: data.lesson.title,
      whatYouLearn: data.lesson.whatYouLearn,
      whyImportant: data.lesson.whyImportant,
      whatToDo: data.lesson.whatToDo ?? [],
      miniTask: data.lesson.miniTask,
    },
  };
}