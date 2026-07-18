"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User, getAuth } from "firebase/auth";
const auth = getAuth();
import { supabase } from "../../../lib/supabaseClient";

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

export default function TaskHelperPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // Task input
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Plan + step history
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepRecords, setStepRecords] = useState<StepRecord[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [usedMemory, setUsedMemory] = useState(false);

  // Question composer
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(makeId());
  const originalTaskRef = useRef<string>("");

  const started = steps.length > 0;
  const activeStepIndex = stepRecords.length - 1;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Persist the session to Supabase every time it changes
  useEffect(() => {
    if (!started || !user) return;

    const saveSession = async () => {
      try {
        await supabase.from("task_sessions").upsert(
          {
            id: sessionIdRef.current,
            user_id: user.uid,
            task: originalTaskRef.current,
            goal,
            roadmap: steps,
            session_data: stepRecords,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (error) {
        console.error("Supabase save failed:", error);
      }
    };

    saveSession();
  }, [goal, steps, stepRecords, started, user]);

  async function generateTask() {
    if (!taskInput.trim() || loading) return;
    setLoading(true);
    originalTaskRef.current = taskInput;

    try {
      const res = await fetch("/api/task-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          taskDescription: taskInput,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setGoal(data.goal);
      setSteps(data.steps);
      setStepRecords([{ index: 0, lesson: data.lesson, chat: [] }]);
      setFinished(false);
      setUsedMemory(!!data.usedMemory);
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

    const activeLesson = stepRecords[activeStepIndex].lesson;
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
      const res = await fetch("/api/task-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          lessonTitle: activeLesson.title,
          question: askedQuestion || "(see attached image/link)",
          images: imagePayload,
          links: linkPayload,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setStepRecords((prev) =>
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

    if (nextIndex >= steps.length) {
      setFinished(true);
      return;
    }

    setLessonLoading(true);

    try {
      const res = await fetch("/api/task-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "step",
          goal,
          steps,
          stepIndex: nextIndex,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setStepRecords((prev) => [
        ...prev,
        { index: nextIndex, lesson: data.lesson, chat: [] },
      ]);
    } catch (error) {
      console.error(error);
    }

    setLessonLoading(false);
  }

  function downloadSummary() {
    const lines: string[] = [];
    lines.push(`GOAL: ${goal}`);
    lines.push("");
    lines.push("FULL PLAN:");
    steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push("");
    lines.push("=".repeat(60));
    lines.push("");

    stepRecords.forEach((record) => {
      lines.push(`STEP ${record.index + 1}: ${record.lesson.title}`);
      lines.push("");
      lines.push("What You'll Learn:");
      lines.push(record.lesson.whatYouLearn);
      lines.push("");
      lines.push("Why It's Important:");
      lines.push(record.lesson.whyImportant);
      lines.push("");
      lines.push("What To Do:");
      record.lesson.whatToDo.forEach((task, i) => {
        lines.push(`  ${i + 1}. ${task}`);
      });

      if (record.chat.length > 0) {
        lines.push("");
        lines.push("Q&A for this step:");
        record.chat.forEach((entry) => {
          lines.push(`  Q: ${entry.question}`);
          lines.push(`  A: ${entry.answer}`);
        });
      }

      lines.push("");
      lines.push("-".repeat(60));
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${goal.replace(/[^\w\s-]/g, "").trim() || "task-summary"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="career-page">
      <Image
        src="/chat-area-v2.png"
        alt="Task Helper Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!started && (
            <div className="skill-screen">
              <h1>What do you need help with?</h1>
              <p className="skill-subtitle">
                Ask NEXUS AI anything.
              </p>

              <textarea
                value={taskInput}
                placeholder="Example: How do I make a LinkedIn account?"
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    generateTask();
                  }
                }}
              />

              <button
                className="primary-button"
                onClick={generateTask}
                disabled={loading}
              >
                {loading ? "Generating..." : "🚀 Generate Plan"}
              </button>
            </div>
          )}

          {started && (
            <>
              {/* BOX 1: The plan — its own standalone card */}
              <div className="roadmap-card">
                <h1>🎯 {goal}</h1>
                <h2>🗺️ Your Full Plan</h2>
                <p className="roadmap-intro">
                  Here's everything you'll work through, step by step, to get
                  there 👇
                  {usedMemory && (
                    <span className="memory-note">
                      {" "}
                      🧠 Personalized using what NEXUS AI remembers about you.
                    </span>
                  )}
                </p>

                <div className="roadmap-list">
                  {steps.map((step, index) => (
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

                <button className="secondary-button" onClick={downloadSummary}>
                  ⬇️ Download Summary (.txt)
                </button>
              </div>

              {/* BOX 2+: Each step gets its own lesson box + its own ask box */}
              <div className="lesson-feed-card">
                <div className="steps-feed">
                  {stepRecords.map((step, i) => {
                    const isActive = i === activeStepIndex;

                    return (
                      <div key={step.index} className="step-block">
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
                                                className="chat-area-v2.png"
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
                                    <p>{entry.question}</p>
                                  </div>
                                  <div className="gpt-msg gpt-msg-ai">
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
                                  🎉 You've completed every step of this task!
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

                        {i < stepRecords.length - 1 && (
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