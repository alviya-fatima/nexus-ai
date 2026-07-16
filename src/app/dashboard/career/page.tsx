"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Lesson = {
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
};

type Attachment =
  | { id: string; kind: "image"; dataUrl: string; name: string }
  | { id: string; kind: "link"; url: string };

type ChatEntry = {
  question: string;
  answer: string;
  attachments?: Attachment[];
};

type StepRecord = {
  index: number;
  lesson: Lesson;
  chat: ChatEntry[];
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CareerPage() {
  // Skill input
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(false);

  // Roadmap + step history
  const [goal, setGoal] = useState("");
  const [roadmap, setRoadmap] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  // Question composer (always applies to the latest/active step)
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const started = roadmap.length > 0;
  const activeStepIndex = steps.length - 1;

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [steps.length]);

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
      setSteps([{ index: 0, lesson: data.lesson, chat: [] }]);
      setFinished(false);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;

    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          { id: makeId(), kind: "image", dataUrl, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addLinkAttachment() {
    const trimmed = linkDraft.trim();
    if (!trimmed) return;

    setAttachments((prev) => [
      ...prev,
      { id: makeId(), kind: "link", url: trimmed },
    ]);
    setLinkDraft("");
    setLinkInputOpen(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function askQuestion() {
    if ((!question.trim() && attachments.length === 0) || asking || activeStepIndex < 0)
      return;

    const activeLesson = steps[activeStepIndex].lesson;
    const askedQuestion = question;
    const askedAttachments = attachments;

    const imagePayload = askedAttachments
      .filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image")
      .map((a) => a.dataUrl);

    const linkPayload = askedAttachments
      .filter((a): a is Extract<Attachment, { kind: "link" }> => a.kind === "link")
      .map((a) => a.url);

    setQuestion("");
    setAttachments([]);
    setAsking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          lessonTitle: activeLesson.title,
          question: askedQuestion || "(see attached image/link)",
          images: imagePayload,
          links: linkPayload,
        }),
      });

      const data = await res.json();

      setSteps((prev) =>
        prev.map((step, i) =>
          i === activeStepIndex
            ? {
                ...step,
                chat: [
                  ...step.chat,
                  {
                    question: askedQuestion,
                    answer: data.reply ?? "",
                    attachments: askedAttachments,
                  },
                ],
              }
            : step
        )
      );
    } catch (error) {
      console.error(error);
    }

    setAsking(false);
  }

  async function markDone() {
    if (lessonLoading || activeStepIndex < 0) return;

    const nextIndex = activeStepIndex + 1;

    if (nextIndex >= roadmap.length) {
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
          stepIndex: nextIndex,
        }),
      });

      const data = await res.json();

      setSteps((prev) => [
        ...prev,
        { index: nextIndex, lesson: data.lesson, chat: [] },
      ]);
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
            <>
              {/* BOX 1: Roadmap — its own separate card, bigger text */}
              <div className="roadmap-card">
                <h1>🎯 {goal}</h1>
                <h2>🗺️ Your Roadmap to Conquer</h2>
                <p className="roadmap-intro">
                  Here's everything you'll work through, step by step, to get there 👇
                </p>

                <div className="roadmap-list">
                  {roadmap.map((step, index) => (
                    <div
                      key={index}
                      className={`roadmap-step ${
                        index === activeStepIndex ? "roadmap-step-active" : ""
                      }`}
                    >
                      {index < activeStepIndex
                        ? "✅"
                        : index === activeStepIndex
                        ? "▶️"
                        : "⬜"}{" "}
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              {/* BOX 2+: Scrollable feed — each step gets its own lesson box + its own ask box */}
              <div className="lesson-feed-card">
                <div className="steps-feed" ref={feedRef}>
                  {steps.map((step, i) => {
                    const isActive = i === activeStepIndex;

                    return (
                      <div key={step.index} className="step-block">
                        {/* Separate box: the lesson content itself */}
                        <div className="step-lesson-box">
                          <h2>
                            📚 Step {step.index + 1}: {step.lesson.title}
                          </h2>

                          <div className="lesson-bubble bubble-learn">
                            <h3>📖 What You'll Learn</h3>
                            <p>{step.lesson.whatYouLearn}</p>
                          </div>

                          <div className="lesson-bubble bubble-why">
                            <h3>💡 Why It's Important</h3>
                            <p>{step.lesson.whyImportant}</p>
                          </div>

                          <div className="lesson-bubble bubble-todo">
                            <h3>📝 What To Do</h3>
                            <ul>
                              {step.lesson.whatToDo.map((task, index) => (
                                <li key={index}>{task}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Separate box: ask about this step + its chat thread */}
                        <div className="step-ask-box">
                          <h3 className="ask-heading">
                            💬 Ask anything about Step {step.index + 1}
                          </h3>

                          {step.chat.length > 0 && (
                            <div className="gpt-thread">
                              {step.chat.map((entry, index) => (
                                <div key={index} className="gpt-exchange">
                                  <div className="gpt-msg gpt-msg-user">
                                    {entry.attachments &&
                                      entry.attachments.length > 0 && (
                                        <div className="gpt-attachments">
                                          {entry.attachments.map((att) =>
                                            att.kind === "image" ? (
                                              <img
                                                key={att.id}
                                                src={att.dataUrl}
                                                alt={att.name}
                                                className="gpt-attachment-image"
                                              />
                                            ) : (
                                              <a
                                                key={att.id}
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="gpt-attachment-link"
                                              >
                                                🔗 {att.url}
                                              </a>
                                            )
                                          )}
                                        </div>
                                      )}
                                    {entry.question && <p>{entry.question}</p>}
                                  </div>

                                  <div className="gpt-msg gpt-msg-assistant">
                                    <span className="gpt-avatar">🤖</span>
                                    <p>{entry.answer}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isActive && (
                            <>
                              {attachments.length > 0 && (
                                <div className="composer-attachments">
                                  {attachments.map((att) => (
                                    <div key={att.id} className="composer-chip">
                                      {att.kind === "image" ? (
                                        <img
                                          src={att.dataUrl}
                                          alt={att.name}
                                          className="composer-chip-image"
                                        />
                                      ) : (
                                        <span className="composer-chip-link">
                                          🔗 {att.url}
                                        </span>
                                      )}
                                      <button
                                        className="composer-chip-remove"
                                        onClick={() => removeAttachment(att.id)}
                                        aria-label="Remove attachment"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {linkInputOpen && (
                                <div className="link-input-row">
                                  <input
                                    type="text"
                                    value={linkDraft}
                                    placeholder="Paste a link..."
                                    onChange={(e) =>
                                      setLinkDraft(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addLinkAttachment();
                                      }
                                    }}
                                  />
                                  <button onClick={addLinkAttachment}>
                                    Add
                                  </button>
                                </div>
                              )}

                              <textarea
                                value={question}
                                placeholder={`Ask about Step ${
                                  step.index + 1
                                }...`}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    askQuestion();
                                  }
                                }}
                              />

                              <div className="composer-toolbar">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  hidden
                                  onChange={(e) =>
                                    handleFilesSelected(e.target.files)
                                  }
                                />
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => fileInputRef.current?.click()}
                                  title="Upload image"
                                >
                                  📷 Image
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => setLinkInputOpen((v) => !v)}
                                  title="Add link"
                                >
                                  🔗 Link
                                </button>

                                <button
                                  className="secondary-button"
                                  onClick={askQuestion}
                                  disabled={asking}
                                >
                                  {asking ? "Thinking..." : "Ask NEXUS AI"}
                                </button>
                              </div>

                              {finished ? (
                                <p className="finished-text">
                                  🎉 You've completed every step in this
                                  roadmap!
                                </p>
                              ) : (
                                <button
                                  className="done-button"
                                  onClick={markDone}
                                  disabled={lessonLoading}
                                >
                                  {lessonLoading
                                    ? "Loading next step..."
                                    : "✅ Done — Next Step"}
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {i < steps.length - 1 && (
                          <hr className="step-divider" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}