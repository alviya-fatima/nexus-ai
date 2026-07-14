export type Memory = {
  skill: string;
  goal: string;
  currentStep: number;
  completedSteps: number[];
};

const KEY = "nexus-memory";

export function loadMemory(): Memory | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(KEY);

  if (!raw) return null;

  return JSON.parse(raw);
}

export function saveMemory(memory: Memory) {
  if (typeof window === "undefined") return;

  localStorage.setItem(KEY, JSON.stringify(memory));
}

export function clearMemory() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(KEY);
}

export function updateCurrentStep(step: number) {
  const memory = loadMemory();

  if (!memory) return;

  memory.currentStep = step;

  saveMemory(memory);
}

export function completeStep(step: number) {
  const memory = loadMemory();

  if (!memory) return;

  if (!memory.completedSteps.includes(step)) {
    memory.completedSteps.push(step);
  }

  memory.currentStep = step + 1;

  saveMemory(memory);
}