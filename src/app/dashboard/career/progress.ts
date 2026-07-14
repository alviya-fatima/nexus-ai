export type Progress = {
  currentStep: number;
  completedSteps: number[];
};

const KEY = "nexus-progress";

export function getProgress(): Progress {
  if (typeof window === "undefined") {
    return {
      currentStep: 1,
      completedSteps: [],
    };
  }

  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return {
      currentStep: 1,
      completedSteps: [],
    };
  }

  return JSON.parse(raw);
}

export function saveProgress(progress: Progress) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    KEY,
    JSON.stringify(progress)
  );
}

export function completeCurrentStep() {
  const progress = getProgress();

  if (
    !progress.completedSteps.includes(progress.currentStep)
  ) {
    progress.completedSteps.push(progress.currentStep);
  }

  progress.currentStep += 1;

  saveProgress(progress);

  return progress;
}

export function resetProgress() {
  localStorage.removeItem(KEY);
}