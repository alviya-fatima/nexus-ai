"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase/config";
import { supabase } from "../../lib/supabaseClient";

type Message = { role: "user" | "assistant"; text: string };

type QAPair = { question: string; answer: string };

type PerQuestionReport = {
  question: string;
  whatItAssessed: string;
  howYouAnswered: string;
  feedback: string;
};

type InterviewReport = {
  overallScore: number;
  overallSummary: string;
  strengths: string[];
  areasToImprove: string[];
  perQuestion: PerQuestionReport[];
};

type Phase = "chat" | "interview-setup" | "interviewing" | "report";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSpeechRecognition(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function CompanionPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const [phase, setPhase] = useState<Phase>("chat");

  // General voice chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);

  // Interview setup
  const [resumeText, setResumeText] = useState("");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Entry-level");
  const [startingInterview, setStartingInterview] = useState(false);

  // Interview in progress
  const [interviewIntro, setInterviewIntro] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<QAPair[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");

  // Report
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(makeId());

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
    const SpeechRecognitionCtor = getSpeechRecognition();
    setVoiceSupported(!!SpeechRecognitionCtor);
  }, []);

  // Persist session to Supabase whenever anything meaningful changes
  useEffect(() => {
    if (!user) return;
    if (messages.length === 0 && transcript.length === 0 && !report) return;

    const saveSession = async () => {
      try {
        await supabase.from("voice_sessions").upsert(
          {
            id: sessionIdRef.current,
            user_id: user.uid,
            mode: phase === "interviewing" || phase === "report" ? "interview" : "chat",
            transcript: phase === "interviewing" || phase === "report" ? transcript : messages,
            report,
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
  }, [messages, transcript, report, user]);

  function speak(text: string, onEnd?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  }

  function startListening(onFinalTranscript: (text: string) => void) {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      onFinalTranscript(text);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // ---------------- General voice chat ----------------

  async function handleUserSpeech(text: string) {
    if (!text.trim()) return;

    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setThinking(true);

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          message: text,
          userId: user?.uid,
          history: newMessages.slice(-12),
        }),
      });

      const data = await res.json();
      const reply = data.reply ?? "Sorry, I didn't quite catch that.";

      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setThinking(false);
      speak(reply);
    } catch (error) {
      console.error(error);
      setThinking(false);
    }
  }

  function handleMicClick() {
    if (listening) {
      stopListening();
      return;
    }
    startListening(handleUserSpeech);
  }

  // ---------------- Mock interview flow ----------------

  async function beginInterview() {
    if (!role.trim() || !resumeText.trim() || startingInterview) return;
    setStartingInterview(true);

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "interview_start",
          resumeText,
          role,
          experienceLevel,
          userId: user?.uid,
        }),
      });

      const data = await res.json();

      setInterviewIntro(data.introMessage);
      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setTranscript([]);
      setReport(null);
      setPhase("interviewing");

      speak(data.introMessage, () => {
        if (data.questions.length > 0) {
          speak(data.questions[0]);
        }
      });
    } catch (error) {
      console.error(error);
    }

    setStartingInterview(false);
  }

  function handleInterviewAnswer(text: string) {
    setCurrentAnswer(text);
  }

  function submitAnswerAndAdvance() {
    const question = questions[currentQuestionIndex];
    const updatedTranscript = [
      ...transcript,
      { question, answer: currentAnswer },
    ];
    setTranscript(updatedTranscript);
    setCurrentAnswer("");

    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      generateReport(updatedTranscript);
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    speak(questions[nextIndex]);
  }

  async function generateReport(finalTranscript: QAPair[]) {
    setReportLoading(true);
    setPhase("report");
    window.speechSynthesis?.cancel();

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "interview_report",
          role,
          transcript: finalTranscript,
          userId: user?.uid,
        }),
      });

      const data = await res.json();
      setReport(data);
    } catch (error) {
      console.error(error);
    }

    setReportLoading(false);
  }

  function endInterviewEarly() {
    generateReport(transcript);
  }

  function startNewSession() {
    sessionIdRef.current = makeId();
    setPhase("chat");
    setMessages([]);
    setResumeText("");
    setRole("");
    setExperienceLevel("Entry-level");
    setInterviewIntro("");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTranscript([]);
    setCurrentAnswer("");
    setReport(null);
  }

  return (
    <main className="career-page">
      <Image
        src="/chat-area-v2.png"
        alt="Companion Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!voiceSupported && (
            <div className="roadmap-card">
              <p>
                ⚠️ Voice input isn't supported in this browser. Please use
                Chrome or Edge for the full voice experience.
              </p>
            </div>
          )}

          {/* ---------------- CHAT PHASE ---------------- */}
          {phase === "chat" && (
            <>
              <div className="roadmap-card">
                <h1>🎙️ Talk to NEXUS AI</h1>
                <p className="roadmap-intro">
                  Tap the mic and talk — about a problem, a project, how
                  you're feeling, anything. Or start a mock interview below.
                </p>

                <button
                  className={`mic-button ${listening ? "mic-button-listening" : ""}`}
                  onClick={handleMicClick}
                  disabled={thinking}
                >
                  {listening ? "🎙️ Listening..." : "🎤"}
                </button>

                {thinking && <p className="loading-text">NEXUS AI is thinking...</p>}

                <button
                  className="secondary-button"
                  onClick={() => setPhase("interview-setup")}
                >
                  🎯 Start Mock Interview
                </button>
              </div>

              {messages.length > 0 && (
                <div className="lesson-feed-card">
                  <div className="gpt-thread">
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        className={`gpt-msg ${
                          m.role === "user" ? "gpt-msg-user" : "gpt-msg-assistant"
                        }`}
                      >
                        {m.role === "assistant" && (
                          <span className="gpt-avatar">🤖</span>
                        )}
                        <p>{m.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------------- INTERVIEW SETUP PHASE ---------------- */}
          {phase === "interview-setup" && (
            <div className="roadmap-card">
              <h1>🎯 Set Up Your Mock Interview</h1>
              <p className="roadmap-intro">
                Give NEXUS AI what it needs to run a realistic, tailored
                interview.
              </p>

              <p className="step-ask-box-label">Paste your resume / background</p>
              <textarea
                className="companion-textarea"
                value={resumeText}
                placeholder="Paste your resume text here (experience, skills, education, projects)..."
                onChange={(e) => setResumeText(e.target.value)}
              />

              <p className="step-ask-box-label">Role you're interviewing for</p>
              <input
                className="companion-input"
                type="text"
                value={role}
                placeholder="e.g. Frontend Developer, Product Manager..."
                onChange={(e) => setRole(e.target.value)}
              />

              <p className="step-ask-box-label">Experience level</p>
              <select
                className="companion-input"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option>Entry-level</option>
                <option>Mid-level</option>
                <option>Senior</option>
                <option>Lead / Principal</option>
              </select>

              <div className="composer-toolbar">
                <button
                  className="icon-button"
                  onClick={() => setPhase("chat")}
                >
                  ← Back
                </button>
                <button
                  className="primary-button"
                  onClick={beginInterview}
                  disabled={startingInterview}
                >
                  {startingInterview ? "Preparing..." : "🚀 Begin Interview"}
                </button>
              </div>
            </div>
          )}

          {/* ---------------- INTERVIEWING PHASE ---------------- */}
          {phase === "interviewing" && (
            <>
              <div className="roadmap-card">
                <h1>🎯 Mock Interview: {role}</h1>
                <p className="roadmap-intro">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
                <div className="interview-question-box">
                  {questions[currentQuestionIndex]}
                </div>
              </div>

              <div className="lesson-feed-card">
                <div className="step-ask-box">
                  <h3 className="ask-heading">🎙️ Your Answer</h3>

                  <button
                    className={`mic-button ${listening ? "mic-button-listening" : ""}`}
                    onClick={() => {
                      if (listening) {
                        stopListening();
                        return;
                      }
                      startListening(handleInterviewAnswer);
                    }}
                  >
                    {listening ? "🎙️ Listening..." : "🎤"}
                  </button>

                  <textarea
                    className="companion-textarea"
                    value={currentAnswer}
                    placeholder="Your spoken answer will appear here — you can also type/edit it..."
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                  />

                  <div className="composer-toolbar">
                    <button
                      className="secondary-button"
                      onClick={submitAnswerAndAdvance}
                      disabled={!currentAnswer.trim()}
                    >
                      {currentQuestionIndex + 1 >= questions.length
                        ? "✅ Submit Final Answer"
                        : "➡️ Submit & Next Question"}
                    </button>
                    <button className="icon-button" onClick={endInterviewEarly}>
                      ⏹️ End Interview Now
                    </button>
                  </div>
                </div>
              </div>

              {transcript.length > 0 && (
                <div className="lesson-feed-card">
                  <div className="gpt-thread">
                    {transcript.map((qa, i) => (
                      <div key={i} className="gpt-exchange">
                        <div className="gpt-msg gpt-msg-assistant">
                          <span className="gpt-avatar">🤖</span>
                          <p>{qa.question}</p>
                        </div>
                        <div className="gpt-msg gpt-msg-user">
                          <p>{qa.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------------- REPORT PHASE ---------------- */}
          {phase === "report" && (
            <div className="roadmap-card">
              <h1>📊 Interview Report: {role}</h1>

              {reportLoading && (
                <p className="loading-text">Generating your report...</p>
              )}

              {report && (
                <>
                  <div className="report-score-badge">
                    {report.overallScore}/100
                  </div>

                  <div className="lesson-bubble bubble-learn">
                    <h3>📋 Overall Summary</h3>
                    <p>{report.overallSummary}</p>
                  </div>

                  <div className="lesson-bubble bubble-why">
                    <h3>💪 Strengths</h3>
                    <ul>
                      {report.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="lesson-bubble bubble-todo">
                    <h3>📈 Areas To Improve</h3>
                    <ul>
                      {report.areasToImprove.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <h2>🔍 Question-by-Question Breakdown</h2>
                  {report.perQuestion.map((pq, i) => (
                    <div key={i} className="step-lesson-box">
                      <h2>
                        Q{i + 1}: {pq.question}
                      </h2>
                      <div className="lesson-bubble bubble-learn">
                        <h3>🎯 What It Assessed</h3>
                        <p>{pq.whatItAssessed}</p>
                      </div>
                      <div className="lesson-bubble bubble-why">
                        <h3>🗣️ How You Answered</h3>
                        <p>{pq.howYouAnswered}</p>
                      </div>
                      <div className="lesson-bubble bubble-todo">
                        <h3>💡 Feedback</h3>
                        <p>{pq.feedback}</p>
                      </div>
                    </div>
                  ))}

                  <button className="primary-button" onClick={startNewSession}>
                    🔄 Start a New Session
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}