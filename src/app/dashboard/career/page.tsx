"use client";

import { useState } from "react";
import Image from "next/image";

type Lesson = {
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
  miniTask: string;
};

type ChatEntry = {
  question: string;
  answer: string;
};

export default function CareerPage() {
  // Skill input
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(false);

  // Roadmap + lessons
  const [goal, setGoal] = useState("");
  const [roadmap, setRoadmap] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  // Per-step Q&A chat
  const [chatByStep, setChatByStep] = useState<Record<number, ChatEntry[]>>({});
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const started = roadmap.length > 0;
  const currentChat = chatByStep[currentStep] ?? [];

  async function generateRoadmap() {
    if (!skill.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "roadmap", message: skill }),
      });

      const data = await res.json();

      setGoal(data.goal);
      setRoadmap(data.roadmap);
      setLesson(data.lesson);
      setCurrentStep(0);
      setChatByStep({});
      setFinished(false);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  async function askQuestion() {
    if (!question.trim() || asking || !lesson) return;
    const askedQuestion = question;
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          lessonTitle: lesson.title,
          question: askedQuestion,
        }),
      });

      const data = await res.json();

      setChatByStep((prev) => ({
        ...prev,
        [currentStep]: [
          ...(prev[currentStep] ?? []),
          { question: askedQuestion, answer: data.reply ?? "" },
        ],
      }));
    } catch (error) {
      console.error(error);
    }

    setAsking(false);
  }

  async function markDone() {
    if (lessonLoading) return;

    const nextStep = currentStep + 1;

    if (nextStep >= roadmap.length) {
      setFinished(true);
      return;
    }

    setLessonLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "lesson",
          goal,
          roadmap,
          stepIndex: nextStep,
        }),
      });

      const data = await res.json();

      setLesson(data.lesson);
      setCurrentStep(nextStep);
    } catch (error) {
      console.error(error);
    }

    setLessonLoading(false);
  }

  return (
    <main className="career-page">
      <Image
        src="/chat-area-v2.png"
        alt="Career Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!started && (
            <div className="skill-screen">
              <h1>What do you want to learn?</h1>
              <p className="skill-subtitle">
                Tell NEXUS AI any skill and it will build you a step-by-step roadmap.
              </p>

              <textarea
                value={skill}
                placeholder="Example: Java, Cybersecurity, UI Design..."
                onChange={(e) => setSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    generateRoadmap();
                  }
                }}
              />

              <button
                className="primary-button"
                onClick={generateRoadmap}
                disabled={loading}
              >
                {loading ? "Generating..." : "🚀 Generate Roadmap"}
              </button>
            </div>
          )}

          {started && (
            <div className="chat-card">
              <h1>🎯 {goal}</h1>

              <h2>🗺️ Learning Roadmap</h2>

              <div className="roadmap-list">
                {roadmap.map((step, index) => (
                  <div
                    key={index}
                    className={`roadmap-step ${
                      index === currentStep ? "roadmap-step-active" : ""
                    }`}
                  >
                    {index < currentStep
                      ? "✅"
                      : index === currentStep
                      ? "▶️"
                      : "⬜"}{" "}
                    {step}
                  </div>
                ))}
              </div>

              <hr />

              {lessonLoading || !lesson ? (
                <p className="loading-text">Loading next lesson...</p>
              ) : (
                <>
                  <h2>
                    📚 Step {currentStep + 1}: {lesson.title}
                  </h2>

                  <section>
                    <h3>📖 What You'll Learn</h3>
                    <p>{lesson.whatYouLearn}</p>
                  </section>

                  <section>
                    <h3>💡 Why It's Important</h3>
                    <p>{lesson.whyImportant}</p>
                  </section>

                  <section>
                    <h3>📝 What To Do</h3>
                    <ul>
                      {lesson.whatToDo.map((task, index) => (
                        <li key={index}>{task}</li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>🎯 Mini Task</h3>
                    <p>{lesson.miniTask}</p>
                  </section>

                  <hr />

                  <h3>💬 Ask anything about this step</h3>

                  {currentChat.length > 0 && (
                    <div className="step-chat-history">
                      {currentChat.map((entry, index) => (
                        <div key={index} className="step-chat-entry">
                          <p className="step-chat-question">
                            🙋 {entry.question}
                          </p>
                          <p className="step-chat-answer">
                            🤖 {entry.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={question}
                    placeholder={`Ask about Step ${currentStep + 1}...`}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        askQuestion();
                      }
                    }}
                  />

                  <button
                    className="secondary-button"
                    onClick={askQuestion}
                    disabled={asking}
                  >
                    {asking ? "Thinking..." : "Ask NEXUS AI"}
                  </button>

                  {finished ? (
                    <p className="finished-text">
                      🎉 You've completed every step in this roadmap!
                    </p>
                  ) : (
                    <button className="done-button" onClick={markDone}>
                      ✅ Done — Next Step
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}