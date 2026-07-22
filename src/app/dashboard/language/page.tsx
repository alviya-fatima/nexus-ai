"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import { supabase } from "../../../lib/supabaseClient";

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

type QuizQuestionType =
  | "multiple_choice"
  | "translate_to_target"
  | "translate_to_english"
  | "listening"
  | "word_bank";

type QuizQuestion = {
  type: QuizQuestionType;
  prompt: string;
  options?: string[];
  wordBank?: string[];
  speakText?: string;
  correctAnswer: string;
  explanation: string;
};

type LessonRecord = {
  index: number;
  lesson: Lesson;
  chat: ChatEntry[];
  quiz: QuizQuestion[] | null;
  quizLoading: boolean;
  quizIndex: number;
  lives: number;
  streak: number;
  correctCount: number;
  quizFinished: boolean;
  lastResult: "correct" | "wrong" | null;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.,!?]/g, "");
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

  const [answerDraft, setAnswerDraft] = useState("");
  const [selectedWordBank, setSelectedWordBank] = useState<string[]>([]);

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
      } catch (error) {
        console.error("Supabase save failed:", error);
      }
    };

    saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, roadmap, lessonRecords, started, user]);

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
          quizIndex: 0,
          lives: 3,
          streak: 0,
          correctCount: 0,
          quizFinished: false,
          lastResult: null,
        },
      ]);
      setFinished(false);
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
            ? { ...rec, chat: [...rec.chat, { question: askedQuestion, answer: data.reply ?? "" }] }
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
                quizIndex: 0,
                lives: 3,
                streak: 0,
                correctCount: 0,
                quizFinished: false,
                lastResult: null,
              }
            : rec
        )
      );
      setAnswerDraft("");
      setSelectedWordBank([]);
    } catch (error) {
      console.error(error);
      setLessonRecords((prev) =>
        prev.map((rec, i) => (i === activeIndex ? { ...rec, quizLoading: false } : rec))
      );
    }
  }

  function currentQuestion(): QuizQuestion | null {
    if (!activeRecord?.quiz) return null;
    return activeRecord.quiz[activeRecord.quizIndex] ?? null;
  }

  function submitAnswer(rawAnswer: string) {
    const q = currentQuestion();
    if (!q || activeRecord.lastResult) return;

    const isCorrect = normalize(rawAnswer) === normalize(q.correctAnswer);

    setLessonRecords((prev) =>
      prev.map((rec, i) => {
        if (i !== activeIndex) return rec;

        const newLives = isCorrect ? rec.lives : rec.lives - 1;
        return {
          ...rec,
          lastResult: isCorrect ? "correct" : "wrong",
          streak: isCorrect ? rec.streak + 1 : 0,
          correctCount: isCorrect ? rec.correctCount + 1 : rec.correctCount,
          lives: newLives,
        };
      })
    );
  }

  function nextQuestion() {
    setAnswerDraft("");
    setSelectedWordBank([]);

    setLessonRecords((prev) =>
      prev.map((rec, i) => {
        if (i !== activeIndex || !rec.quiz) return rec;

        const outOfLives = rec.lives <= 0;
        const nextIndex = rec.quizIndex + 1;
        const isLastQuestion = nextIndex >= rec.quiz.length;

        if (outOfLives || isLastQuestion) {
          return { ...rec, quizFinished: true, lastResult: null };
        }

        return { ...rec, quizIndex: nextIndex, lastResult: null };
      })
    );
  }

  function toggleWordBankPiece(piece: string) {
    setSelectedWordBank((prev) =>
      prev.includes(piece) ? prev.filter((p) => p !== piece) : [...prev, piece]
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
          quizIndex: 0,
          lives: 3,
          streak: 0,
          correctCount: 0,
          quizFinished: false,
          lastResult: null,
        },
      ]);
    } catch (error) {
      console.error(error);
    }

    setLessonLoading(false);
  }

  const q = currentQuestion();
  const passed = activeRecord?.quiz
    ? activeRecord.correctCount / activeRecord.quiz.length >= 0.8
    : false;

  return (
    <main className="career-page">
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
                teaches you vocabulary with pronunciation, and tests you hard.
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

              <button className="primary-button" onClick={generateRoadmap} disabled={loading}>
                {loading ? "Generating..." : "🚀 Generate Roadmap"}
              </button>
            </div>
          )}

          {started && (
            <>
              <div className="roadmap-card">
                <h1>🎯 {goal}</h1>
                <h2>🗺️ Your Full Lesson Plan</h2>
                <p className="roadmap-intro">Here's every lesson you'll work through, in order 👇</p>

                <div className="roadmap-list">
                  {roadmap.map((step, index) => (
                    <div
                      key={index}
                      className={`roadmap-step ${index === activeIndex ? "roadmap-step-active" : ""}`}
                    >
                      {index < activeIndex ? "✅" : index === activeIndex ? "▶️" : "⬜"} {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lesson-feed-card">
                <div className="steps-feed">
                  {lessonRecords.map((rec, i) => {
                    const isActive = i === activeIndex;

                    return (
                      <div key={rec.index} className="step-block">
                        <div className="step-lesson-box">
                          <h2>📚 Lesson {rec.index + 1}: {rec.lesson.title}</h2>

                          <div className="lesson-bubble bubble-learn">
                            <h3>📖 Overview</h3>
                            <p>{rec.lesson.overview}</p>
                          </div>

                          <div className="vocab-grid">
                            {rec.lesson.words.map((w, wi) => (
                              <div key={wi} className="vocab-card">
                                <div className="vocab-word">{w.word}</div>
                                <div className="vocab-pronunciation">🗣️ {w.pronunciation}</div>
                                <div className="vocab-meaning">{w.meaning}</div>
                                <div className="vocab-example">{w.usageExample}</div>
                                <button className="vocab-play-button" onClick={() => speakWord(w.word)}>
                                  🔊 Play Pronunciation
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="step-ask-box">
                          <h3 className="ask-heading">💬 Ask anything about Lesson {rec.index + 1}</h3>

                          {rec.chat.length > 0 && (
                            <div className="gpt-thread">
                              {rec.chat.map((entry, ci) => (
                                <div key={ci} className="gpt-exchange">
                                  <div className="gpt-msg gpt-msg-user"><p>{entry.question}</p></div>
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
                                <button className="secondary-button" onClick={askQuestion} disabled={asking}>
                                  {asking ? "Thinking..." : "Ask NEXUS AI"}
                                </button>
                                <button className="done-button" onClick={startQuiz} disabled={rec.quizLoading}>
                                  {rec.quizLoading ? "Preparing test..." : "🔥 Take Intense Test"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {isActive && rec.quiz && !rec.quizFinished && q && (
                          <div className="quiz-box">
                            <div className="quiz-hud">
                              <span className="quiz-hud-lives">
                                {"❤️".repeat(Math.max(rec.lives, 0))}
                                {"🖤".repeat(Math.max(3 - rec.lives, 0))}
                              </span>
                              <span className="quiz-hud-progress">
                                {rec.quizIndex + 1} / {rec.quiz.length}
                              </span>
                              <span className="quiz-hud-streak">🔥 {rec.streak}</span>
                            </div>

                            <div className="quiz-progress-bar">
                              <div
                                className="quiz-progress-fill"
                                style={{ width: `${((rec.quizIndex) / rec.quiz.length) * 100}%` }}
                              />
                            </div>

                            <p className="quiz-question-text">{q.prompt}</p>

                            {q.type === "multiple_choice" && (
                              <div className="quiz-options">
                                {q.options?.map((opt, oi) => {
                                  let cls = "quiz-option";
                                  if (rec.lastResult) {
                                    if (normalize(opt) === normalize(q.correctAnswer)) cls += " quiz-option-correct";
                                    else if (normalize(opt) === normalize(answerDraft)) cls += " quiz-option-wrong";
                                  }
                                  return (
                                    <button
                                      key={oi}
                                      className={cls}
                                      disabled={!!rec.lastResult}
                                      onClick={() => {
                                        setAnswerDraft(opt);
                                        submitAnswer(opt);
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {(q.type === "translate_to_target" || q.type === "translate_to_english") && (
                              <div className="quiz-type-answer">
                                <input
                                  className="companion-input"
                                  type="text"
                                  value={answerDraft}
                                  disabled={!!rec.lastResult}
                                  placeholder="Type your answer..."
                                  onChange={(e) => setAnswerDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !rec.lastResult) submitAnswer(answerDraft);
                                  }}
                                />
                                {!rec.lastResult && (
                                  <button className="secondary-button" onClick={() => submitAnswer(answerDraft)}>
                                    Check
                                  </button>
                                )}
                              </div>
                            )}

                            {q.type === "listening" && (
                              <div className="quiz-type-answer">
                                <button
                                  className="vocab-play-button"
                                  onClick={() => speakWord(q.speakText || q.correctAnswer)}
                                >
                                  🔊 Play Audio
                                </button>
                                <input
                                  className="companion-input"
                                  type="text"
                                  value={answerDraft}
                                  disabled={!!rec.lastResult}
                                  placeholder="Type what you hear..."
                                  onChange={(e) => setAnswerDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !rec.lastResult) submitAnswer(answerDraft);
                                  }}
                                />
                                {!rec.lastResult && (
                                  <button className="secondary-button" onClick={() => submitAnswer(answerDraft)}>
                                    Check
                                  </button>
                                )}
                              </div>
                            )}

                            {q.type === "word_bank" && (
                              <div className="quiz-type-answer">
                                <div className="word-bank-built">
                                  {selectedWordBank.length === 0 && (
                                    <span className="word-bank-placeholder">Tap words below...</span>
                                  )}
                                  {selectedWordBank.map((piece, pi) => (
                                    <button
                                      key={pi}
                                      className="word-bank-chip word-bank-chip-selected"
                                      disabled={!!rec.lastResult}
                                      onClick={() =>
                                        setSelectedWordBank((prev) => prev.filter((_, idx) => idx !== pi))
                                      }
                                    >
                                      {piece}
                                    </button>
                                  ))}
                                </div>
                                <div className="word-bank-pool">
                                  {q.wordBank
                                    ?.filter((piece) => !selectedWordBank.includes(piece))
                                    .map((piece, pi) => (
                                      <button
                                        key={pi}
                                        className="word-bank-chip"
                                        disabled={!!rec.lastResult}
                                        onClick={() => toggleWordBankPiece(piece)}
                                      >
                                        {piece}
                                      </button>
                                    ))}
                                </div>
                                {!rec.lastResult && (
                                  <button
                                    className="secondary-button"
                                    onClick={() => submitAnswer(selectedWordBank.join(" "))}
                                    disabled={selectedWordBank.length === 0}
                                  >
                                    Check
                                  </button>
                                )}
                              </div>
                            )}

                            {rec.lastResult && (
                              <div className={`quiz-feedback quiz-feedback-${rec.lastResult}`}>
                                <p className="quiz-feedback-title">
                                  {rec.lastResult === "correct" ? "✅ Correct!" : "❌ Not quite"}
                                </p>
                                {rec.lastResult === "wrong" && (
                                  <p className="quiz-feedback-answer">Correct answer: {q.correctAnswer}</p>
                                )}
                                <p className="quiz-explanation">💡 {q.explanation}</p>
                                <button className="primary-button" onClick={nextQuestion}>
                                  Continue
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {isActive && rec.quiz && rec.quizFinished && (
                          <div className="quiz-box">
                            {rec.lives <= 0 ? (
                              <>
                                <p className="quiz-result-title quiz-result-fail">💔 Out of Lives</p>
                                <p className="quiz-score">
                                  {rec.correctCount} / {rec.quiz.length} correct
                                </p>
                                <p className="roadmap-intro">
                                  Review the vocabulary above and try again when you're ready.
                                </p>
                                <button className="secondary-button" onClick={startQuiz}>
                                  🔄 Retry Test
                                </button>
                              </>
                            ) : (
                              <>
                                <p className={`quiz-result-title ${passed ? "quiz-result-pass" : "quiz-result-fail"}`}>
                                  {passed ? "🏆 Test Passed!" : "📉 Below Passing Score"}
                                </p>
                                <p className="quiz-score">
                                  {rec.correctCount} / {rec.quiz.length} correct (
                                  {Math.round((rec.correctCount / rec.quiz.length) * 100)}%) — need 80% to pass
                                </p>
                                {!passed && (
                                  <button className="secondary-button" onClick={startQuiz}>
                                    🔄 Retry Test
                                  </button>
                                )}
                                {passed &&
                                  (finished ? (
                                    <p className="finished-text">
                                      🎉 You've completed every lesson in this language roadmap!
                                    </p>
                                  ) : (
                                    <button className="done-button" onClick={nextLesson} disabled={lessonLoading}>
                                      {lessonLoading ? "Loading next lesson..." : "➡️ Continue to Next Lesson"}
                                    </button>
                                  ))}
                              </>
                            )}
                          </div>
                        )}

                        {i < lessonRecords.length - 1 && <hr className="step-divider" />}
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