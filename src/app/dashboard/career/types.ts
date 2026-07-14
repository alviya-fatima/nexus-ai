export type Roadmap = {
  goal: string;
  roadmap: string[];
};

export type Lesson = {
  step: number;
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
  miniTask: string;
};

export type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      type: "lesson";
      lesson: Lesson;
    }
  | {
      id: string;
      role: "assistant";
      type: "roadmap";
      roadmap: Roadmap;
    }
  | {
      id: string;
      role: "assistant";
      type: "text";
      text: string;
    };