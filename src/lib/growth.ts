import { supabase } from "./supabaseClient";
import { fetchChats } from "./chats";

export type GrowthPoint = {
  date: string;
  label: string;
  value: number;
};

export type GrowthFeatureOption = {
  id: string;
  label: string;
  yAxisLabel: string;
};

export const GROWTH_FEATURES: GrowthFeatureOption[] = [
  { id: "career", label: "🎯 Career & Skill Learning", yAxisLabel: "Roadmap Completion %" },
  { id: "task-helper", label: "🛠️ Project & Task Helper", yAxisLabel: "Plan Completion %" },
  { id: "language", label: "🗣️ Language Learning", yAxisLabel: "Lesson Progress / Quiz Score %" },
  { id: "project-studio", label: "📊 Project Studio", yAxisLabel: "Questions Asked" },
  { id: "companion-interview", label: "🎙️ Mock Interviews", yAxisLabel: "Interview Score" },
  { id: "companion-chat", label: "💬 Voice Chat Activity", yAxisLabel: "Messages Exchanged" },
];

async function loadRow(table: string, id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`loadRow(${table}) failed:`, error.message, error.details, error.hint);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`loadRow(${table}) failed:`, err);
    return null;
  }
}

function averageLessonQuizScore(lessonRecords: any[]): number | null {
  const scored = lessonRecords.filter((r) => r?.quizSubmitted && r?.quiz);
  if (scored.length === 0) return null;

  const percentages = scored.map((r) => {
    const correct = r.quiz.reduce(
      (sum: number, q: any, i: number) =>
        r.userAnswers[i] === q.correctIndex ? sum + 1 : sum,
      0
    );
    return (correct / r.quiz.length) * 100;
  });

  return Math.round(percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length);
}

export async function getGrowthData(
  userId: string,
  featureOption: string
): Promise<GrowthPoint[]> {
  const isCompanion = featureOption.startsWith("companion");
  const table = isCompanion ? "voice_sessions" : "task_sessions";
  const chatFeatureName = isCompanion ? "companion" : featureOption;

  const allChats = await fetchChats(userId);
  const relevantChats = allChats
    .filter((c) => c.feature === chatFeatureName)
    .sort(
      (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );

  const points: GrowthPoint[] = [];

  for (const chat of relevantChats) {
    const row = await loadRow(table, chat.id);
    if (!row) continue;

    let value: number | null = null;

    if (featureOption === "career" || featureOption === "task-helper") {
      const totalSteps = Array.isArray(row.roadmap) ? row.roadmap.length : 0;
      const doneSteps = Array.isArray(row.session_data) ? row.session_data.length : 0;
      value = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : null;
    } else if (featureOption === "language") {
      const lessonRecords = Array.isArray(row.session_data) ? row.session_data : [];
      const quizAvg = averageLessonQuizScore(lessonRecords);
      if (quizAvg !== null) {
        value = quizAvg;
      } else {
        const totalLessons = Array.isArray(row.roadmap) ? row.roadmap.length : 0;
        const doneLessons = lessonRecords.length;
        value = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : null;
      }
    } else if (featureOption === "project-studio") {
      const chatLog = row.session_data?.chat;
      value = Array.isArray(chatLog) ? chatLog.length : 0;
    } else if (featureOption === "companion-interview") {
      if (row.mode === "interview" && row.report?.overallScore != null) {
        value = row.report.overallScore;
      }
    } else if (featureOption === "companion-chat") {
      if (row.mode === "chat" && Array.isArray(row.transcript)) {
        value = row.transcript.length;
      }
    }

    if (value === null) continue;

    points.push({
      date: chat.updated_at,
      label: chat.title,
      value,
    });
  }

  return points;
}