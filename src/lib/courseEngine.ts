export type CourseState = {
  goal: string;
  roadmap: string[];
  currentStep: number;
};

export function createCourse(
  goal: string,
  roadmap: string[]
): CourseState {
  return {
    goal,
    roadmap,
    currentStep: 0,
  };
}

export function getCurrentStep(course: CourseState) {
  return course.roadmap[course.currentStep];
}

export function completeCurrentStep(course: CourseState) {
  if (course.currentStep < course.roadmap.length - 1) {
    return {
      ...course,
      currentStep: course.currentStep + 1,
    };
  }

  return course;
}

export function isCourseFinished(course: CourseState) {
  return course.currentStep >= course.roadmap.length - 1;
}