export type Lesson = {
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
  miniTask: string;
};

export type Course = {
  goal: string;
  roadmap: string[];
  lesson: Lesson;
};

export function parseCourse(data: any): Course {
  return {
    goal: data.goal || "",

    roadmap: Array.isArray(data.roadmap)
      ? data.roadmap
      : [],

    lesson: {
      title: data.lesson?.title || "",

      whatYouLearn:
        data.lesson?.whatYouLearn || "",

      whyImportant:
        data.lesson?.whyImportant || "",

      whatToDo: Array.isArray(
        data.lesson?.whatToDo
      )
        ? data.lesson.whatToDo
        : [],

      miniTask:
        data.lesson?.miniTask || "",
    },
  };
}