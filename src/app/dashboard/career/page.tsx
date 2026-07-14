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

type Roadmap = {
  goal: string;
  roadmap: string[];
};

export default function CareerPage() {
  const [skill, setSkill] = useState("");

  const [loading, setLoading] = useState(false);

  const [roadmap, setRoadmap] =
    useState<Roadmap | null>(null);

  const [lesson, setLesson] =
    useState<Lesson | null>(null);

  const [question, setQuestion] =
    useState("");

  const [answer, setAnswer] =
    useState("");

  async function generateRoadmap() {
    if (!skill.trim()) return;

    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        message: skill,
      }),
    });

    const data = await res.json();

    setRoadmap({
      goal: data.goal,
      roadmap: data.roadmap,
    });

    setLesson(data.lesson);

    setLoading(false);
  }

  async function askLessonQuestion() {
    if (!question.trim()) return;

    const res = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        message: `
Current Lesson:

${lesson?.title}

Student Question:

${question}

Answer ONLY this question.
Do NOT generate another roadmap.
`,
      }),
    });

    const data = await res.json();

    setAnswer(data.reply);
  }

  return (<main className="career-page">

  <Image
    src="/chat-area-v2.png"
    alt="Career Background"
    fill
    priority
    className="career-background"
  />

  <div className="career-overlay">

    {!roadmap && (

      <div className="skill-screen">

        <h1>What do you want to learn?</h1>

        <textarea
          value={skill}
          placeholder="Example: Java, Cybersecurity..."
          onChange={(e) => setSkill(e.target.value)}
        />

        <button
          onClick={generateRoadmap}
          disabled={loading}
        >
          {loading
            ? "Generating..."
            : "Generate Roadmap"}
        </button>

      </div>

    )}

    {roadmap && (

      <>

        <div className="chat-card">

          <h1>
            🎯 {roadmap.goal}
          </h1>

          <h2>
            🗺️ Learning Roadmap
          </h2>

          <div className="roadmap-list">

            {roadmap.roadmap.map(
              (step, index) => (

                <div
                  key={index}
                  className="roadmap-step"
                >
                  {index === 0
                    ? "✅"
                    : "⬜"}{" "}
                  {step}
                </div>

              )
            )}

          </div>

          <hr />

          <h2>
            📚 {lesson?.title}
          </h2>
                    <section>

            <h3>📖 What You'll Learn</h3>

            <p>
              {lesson?.whatYouLearn}
            </p>

          </section>

          <section>

            <h3>💡 Why It's Important</h3>

            <p>
              {lesson?.whyImportant}
            </p>

          </section>

          <section>

            <h3>📝 What To Do</h3>

            <ul>

              {lesson?.whatToDo.map(
                (task, index) => (

                  <li key={index}>
                    {task}
                  </li>

                )
              )}

            </ul>

          </section>

          <section>

            <h3>🎯 Mini Task</h3>

            <p>
              {lesson?.miniTask}
            </p>

          </section>

          <hr />

          <h3>
            Ask anything about this lesson
          </h3>

          <textarea
            value={question}
            placeholder="Ask about Step 1..."
            onChange={(e) =>
              setQuestion(e.target.value)
            }
          />

          <button
            onClick={askLessonQuestion}
          >
            Ask NEXUS AI
          </button>

          {answer && (

            <div className="assistant-answer">

              <h3>Answer</h3>

              <p>{answer}</p>

            </div>

          )}

          <button
            className="done-button"
          >
            ✅ Done
          </button>

        </div>

      </>

    )}

  </div>
  </main>
  );
}