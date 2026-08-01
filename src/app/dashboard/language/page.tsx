"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import { supabase } from "../../../lib/supabaseClient";
import { upsertChat, generateChatMeta } from "../../../lib/chats";

type VocabWord = {
  word: string;
  pronunciation: string;
  meaning: string;
  usageExample: string;
};

type Lesson = {
  title: string;
  overview: string;
  words: VocabWord[];
};

type ChatEntry = { question: string; answer: string };

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type LessonRecord = {
  index: number;
  lesson: Lesson;
  chat: ChatEntry[];
  quiz: QuizQuestion[] | null;
  quizLoading: boolean;
  userAnswers: (number | null)[];
  quizSubmitted: boolean;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function LanguagePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [languageInput, setLanguageInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [goal, setGoal] = useState("");
  const [langCode, setLangCode] = useState("en-US");
  const [roadmap, setRoadmap] = useState<string[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [chatTitle, setChatTitle] = useState("");
  const [chatDescription, setChatDescription] = useState("");

  const sessionIdRef = useRef<string>(makeId());
  const originalLanguageRef = useRef<string>("");

  const started = roadmap.length > 0;
  const activeIndex = lessonRecords.length - 1;
  const activeRecord = lessonRecords[activeIndex];

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

  useEffect(() => {
    if (!started || !user) return;

    const saveSession = async () => {
      try {
        await supabase.from("task_sessions").upsert(
          {
            id: sessionIdRef.current,
            user_id: user.uid,
            task: `Language: ${originalLanguageRef.current}`,
            goal,
            roadmap,
            session_data: lessonRecords,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        await upsertChat({
          id: sessionIdRef.current,
          userId: user.uid,
          feature: "language",
          title: chatTitle || goal || originalLanguageRef.current || "New chat",
          description: chatDescription,
          route: "/dashboard/language",
        });
      } catch (error) {
        console.error("Supabase save failed:", error);
      }
    };

    saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, roadmap, lessonRecords, started, user, chatTitle, chatDescription]);

  function speakWord(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  async function generateRoadmap() {
    if (!languageInput.trim() || loading) return;
    setLoading(true);
    originalLanguageRef.current = languageInput;

    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          language: languageInput,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setGoal(data.goal);
      setLangCode(data.langCode || "en-US");
      setRoadmap(data.roadmap);
      setLessonRecords([
        {
          index: 0,
          lesson: data.lesson,
          chat: [],
          quiz: null,
          quizLoading: false,
          userAnswers: [],
          quizSubmitted: false,
        },
      ]);
      setFinished(false);

      generateChatMeta(languageInput).then(({ title, description }) => {
        setChatTitle(title);
        setChatDescription(description);
      });
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  async function askQuestion() {
    if (!question.trim() || asking || activeIndex < 0) return;

    const activeLesson = lessonRecords[activeIndex].lesson;
    const askedQuestion = question;
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          lessonTitle: activeLesson.title,
          question: askedQuestion,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setLessonRecords((prev) =>
        prev.map((rec, i) =>
          i === activeIndex
            ? {
                ...rec,
                chat: [...rec.chat, { question: askedQuestion, answer: data.reply ?? "" }],
              }
            : rec
        )
      );
    } catch (error) {
      console.error(error);
    }

    setAsking(false);
  }

  async function startQuiz() {
    if (activeIndex < 0) return;

    setLessonRecords((prev) =>
      prev.map((rec, i) => (i === activeIndex ? { ...rec, quizLoading: true } : rec))
    );

    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "quiz",
          lessonTitle: activeRecord.lesson.title,
          words: activeRecord.lesson.words,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setLessonRecords((prev) =>
        prev.map((rec, i) =>
          i === activeIndex
            ? {
                ...rec,
                quiz: data.questions,
                quizLoading: false,
                userAnswers: new Array(data.questions.length).fill(null),
                quizSubmitted: false,
              }
            : rec
        )
      );
    } catch (error) {
      console.error(error);
      setLessonRecords((prev) =>
        prev.map((rec, i) => (i === activeIndex ? { ...rec, quizLoading: false } : rec))
      );
    }
  }

  function selectAnswer(questionIndex: number, optionIndex: number) {
    setLessonRecords((prev) =>
      prev.map((rec, i) => {
        if (i !== activeIndex || rec.quizSubmitted) return rec;
        const updatedAnswers = [...rec.userAnswers];
        updatedAnswers[questionIndex] = optionIndex;
        return { ...rec, userAnswers: updatedAnswers };
      })
    );
  }

  function submitQuiz() {
    setLessonRecords((prev) =>
      prev.map((rec, i) => (i === activeIndex ? { ...rec, quizSubmitted: true } : rec))
    );
  }

  function quizScore(rec: LessonRecord): number {
    if (!rec.quiz) return 0;
    return rec.quiz.reduce(
      (score, q, i) => (rec.userAnswers[i] === q.correctIndex ? score + 1 : score),
      0
    );
  }

  async function nextLesson() {
    if (lessonLoading || activeIndex < 0) return;

    const nextIndex = activeIndex + 1;

    if (nextIndex >= roadmap.length) {
      setFinished(true);
      return;
    }

    setLessonLoading(true);

    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "lesson",
          goal,
          roadmap,
          lessonIndex: nextIndex,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setLessonRecords((prev) => [
        ...prev,
        {
          index: nextIndex,
          lesson: data.lesson,
          chat: [],
          quiz: null,
          quizLoading: false,
          userAnswers: [],
          quizSubmitted: false,
        },
      ]);
    } catch (error) {
      console.error(error);
    }

    setLessonLoading(false);
  }

  return (
    <main className="career-page">
      <button
        className="back-to-dashboard-button"
        onClick={() => router.push("/dashboard")}
      >
        ← Back to Dashboard
      </button>

      <Image
        src="/chat-area-v2.png"
        alt="Language Learning Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!started && (
            <div className="skill-screen">
              <h1>What language do you want to learn?</h1>
              <p className="skill-subtitle">
                Type any language — NEXUS AI builds you a full lesson roadmap,
                teaches you vocabulary with pronunciation, and quizzes you
                along the way.
              </p>

              <textarea
                value={languageInput}
                placeholder="Example: Spanish, Japanese, French..."
                onChange={(e) => setLanguageInput(e.target.value)}
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
              <div className="roadmap-card">
                <h1>🎯 {goal}</h1>
                <h2>🗺️ Your Full Lesson Plan</h2>
                <p className="roadmap-intro">
                  Here's every lesson you'll work through, in order 👇
                </p>

                <div className="roadmap-list">
                  {roadmap.map((step, index) => (
                    <div
                      key={index}
                      className={`roadmap-step ${
                        index === activeIndex ? "roadmap-step-active" : ""
                      }`}
                    >
                      {index < activeIndex
                        ? "✅"
                        : index === activeIndex
                        ? "▶️"
                        : "⬜"}{" "}
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lesson-feed-card">
                <div className="steps-feed">
                  {lessonRecords.map((rec, i) => {
                    const isActive = i === activeIndex;
                    const submitted = rec.quizSubmitted;
                    const score = submitted ? quizScore(rec) : 0;

                    return (
                      <div key={rec.index} className="step-block">
                        <div className="step-lesson-box">
                          <h2>
                            📚 Lesson {rec.index + 1}: {rec.lesson.title}
                          </h2>

                          <div className="lesson-bubble bubble-learn">
                            <h3>📖 Overview</h3>
                            <p>{rec.lesson.overview}</p>
                          </div>

                          <div className="vocab-grid">
                            {rec.lesson.words.map((w, wi) => (
                              <div key={wi} className="vocab-card">
                                <div className="vocab-word">{w.word}</div>
                                <div className="vocab-pronunciation">
                                  🗣️ {w.pronunciation}
                                </div>
                                <div className="vocab-meaning">{w.meaning}</div>
                                <div className="vocab-example">{w.usageExample}</div>
                                <button
                                  className="vocab-play-button"
                                  onClick={() => speakWord(w.word)}
                                >
                                  🔊 Play Pronunciation
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="step-ask-box">
                          <h3 className="ask-heading">
                            💬 Ask anything about Lesson {rec.index + 1}
                          </h3>

                          {rec.chat.length > 0 && (
                            <div className="gpt-thread">
                              {rec.chat.map((entry, ci) => (
                                <div key={ci} className="gpt-exchange">
                                  <div className="gpt-msg gpt-msg-user">
                                    <p>{entry.question}</p>
                                  </div>
                                  <div className="gpt-msg gpt-msg-assistant">
                                    <span className="gpt-avatar">🤖</span>
                                    <p>{entry.answer}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isActive && !rec.quiz && (
                            <>
                              <textarea
                                value={question}
                                placeholder={`Ask about Lesson ${rec.index + 1}...`}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    askQuestion();
                                  }
                                }}
                              />
                              <div className="composer-toolbar">
                                <button
                                  className="secondary-button"
                                  onClick={askQuestion}
                                  disabled={asking}
                                >
                                  {asking ? "Thinking..." : "Ask NEXUS AI"}
                                </button>
                                <button
                                  className="done-button"
                                  onClick={startQuiz}
                                  disabled={rec.quizLoading}
                                >
                                  {rec.quizLoading
                                    ? "Preparing quiz..."
                                    : "🧪 Take Test"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {isActive && rec.quiz && (
                          <div className="quiz-box">
                            <h3>🧪 Lesson {rec.index + 1} Quiz</h3>

                            {rec.quiz.map((q, qi) => (
                              <div key={qi} className="quiz-question">
                                <p className="quiz-question-text">
                                  {qi + 1}. {q.question}
                                </p>
                                <div className="quiz-options">
                                  {q.options.map((opt, oi) => {
                                    const isSelected = rec.userAnswers[qi] === oi;
                                    const isCorrect = oi === q.correctIndex;
                                    let optionClass = "quiz-option";
                                    if (submitted) {
                                      if (isCorrect) optionClass += " quiz-option-correct";
                                      else if (isSelected) optionClass += " quiz-option-wrong";
                                    } else if (isSelected) {
                                      optionClass += " quiz-option-selected";
                                    }
                                    return (
                                      <button
                                        key={oi}
                                        className={optionClass}
                                        onClick={() => selectAnswer(qi, oi)}
                                        disabled={submitted}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                                {submitted && (
                                  <p className="quiz-explanation">
                                    💡 {q.explanation}
                                  </p>
                                )}
                              </div>
                            ))}

                            {!submitted ? (
                              <button
                                className="primary-button"
                                onClick={submitQuiz}
                                disabled={rec.userAnswers.some((a) => a === null)}
                              >
                                ✅ Submit Quiz
                              </button>
                            ) : (
                              <>
                                <p className="quiz-score">
                                  Score: {score} / {rec.quiz.length}
                                </p>
                                {finished ? (
                                  <p className="finished-text">
                                    🎉 You've completed every lesson in this
                                    language roadmap!
                                  </p>
                                ) : (
                                  <button
                                    className="done-button"
                                    onClick={nextLesson}
                                    disabled={lessonLoading}
                                  >
                                    {lessonLoading
                                      ? "Loading next lesson..."
                                      : "➡️ Continue to Next Lesson"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {i < lessonRecords.length - 1 && (
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