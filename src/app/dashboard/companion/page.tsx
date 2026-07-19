"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import { supabase } from "../../../lib/supabaseClient";

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
type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";

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

  // General voice-only chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceChatActive, setVoiceChatActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const voiceChatActiveRef = useRef(false);

  // Interview mic (push-to-talk, unchanged)
  const [listening, setListening] = useState(false);

  // Interview setup — resume is now a PDF upload, not a text box
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Entry-level");
  const [startingInterview, setStartingInterview] = useState(false);

  // Interview in progress
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<QAPair[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");

  // Report
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(makeId());
  const resumeInputRef = useRef<HTMLInputElement>(null);

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

  // ---------------- General voice-only chat (continuous loop) ----------------

  function startVoiceChat() {
    voiceChatActiveRef.current = true;
    setVoiceChatActive(true);
    setVoiceStatus("listening");
    startListening(handleUserSpeech);
  }

  function stopVoiceChat() {
    voiceChatActiveRef.current = false;
    setVoiceChatActive(false);
    setVoiceStatus("idle");
    stopListening();
    window.speechSynthesis?.cancel();
  }

  async function handleUserSpeech(text: string) {
    if (!text.trim()) {
      // Didn't catch anything — if voice chat is still active, listen again
      if (voiceChatActiveRef.current) {
        setVoiceStatus("listening");
        startListening(handleUserSpeech);
      }
      return;
    }

    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setVoiceStatus("thinking");

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
      setVoiceStatus("speaking");

      speak(reply, () => {
        if (voiceChatActiveRef.current) {
          setVoiceStatus("listening");
          startListening(handleUserSpeech);
        } else {
          setVoiceStatus("idle");
        }
      });
    } catch (error) {
      console.error(error);
      if (voiceChatActiveRef.current) {
        setVoiceStatus("listening");
        startListening(handleUserSpeech);
      } else {
        setVoiceStatus("idle");
      }
    }
  }

  // ---------------- Resume upload (PDF only) ----------------

  async function handleResumeFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setResumeError("Please upload a PDF file.");
      return;
    }

    setResumeUploading(true);
    setResumeError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setResumeError(data.error ?? "Failed to read that PDF.");
        setResumeText("");
        setResumeFileName("");
      } else {
        setResumeText(data.text);
        setResumeFileName(data.fileName ?? file.name);
      }
    } catch (error) {
      console.error(error);
      setResumeError("Failed to read that PDF.");
    }

    setResumeUploading(false);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  }

  function clearResume() {
    setResumeText("");
    setResumeFileName("");
    setResumeError("");
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
    stopVoiceChat();
    setPhase("chat");
    setMessages([]);
    clearResume();
    setRole("");
    setExperienceLevel("Entry-level");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTranscript([]);
    setCurrentAnswer("");
    setReport(null);
  }

  const voiceStatusLabel: Record<VoiceStatus, string> = {
    idle: "🎤 Start Voice Chat",
    listening: "🎙️ Listening...",
    thinking: "🤔 Thinking...",
    speaking: "🔊 Speaking...",
  };

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

          {/* ---------------- CHAT PHASE (voice only, no text bubbles) ---------------- */}
          {phase === "chat" && (
            <div className="roadmap-card">
              <h1>🎙️ Talk to NEXUS AI</h1>
              <p className="roadmap-intro">
                This is a voice-only conversation — NEXUS AI listens and
                replies out loud. Talk about a problem, a project, how you're
                feeling, anything.
              </p>

              <button
                className={`mic-button ${
                  voiceStatus !== "idle" ? "mic-button-listening" : ""
                }`}
                onClick={voiceChatActive ? undefined : startVoiceChat}
                disabled={voiceChatActive}
              >
                {voiceChatActive ? "🎙️" : "🎤"}
              </button>

              <p className="voice-status-text">{voiceStatusLabel[voiceStatus]}</p>

              {voiceChatActive && (
                <button className="secondary-button" onClick={stopVoiceChat}>
                  ⏹️ End Voice Chat
                </button>
              )}

              <button
                className="icon-button"
                onClick={() => {
                  stopVoiceChat();
                  setPhase("interview-setup");
                }}
              >
                🎯 Start Mock Interview
              </button>
            </div>
          )}

          {/* ---------------- INTERVIEW SETUP PHASE ---------------- */}
          {phase === "interview-setup" && (
            <div className="roadmap-card">
              <h1>🎯 Set Up Your Mock Interview</h1>
              <p className="roadmap-intro">
                Give NEXUS AI what it needs to run a realistic, tailored
                interview.
              </p>

              <p className="step-ask-box-label">Upload your resume / CV (PDF)</p>

              <input
                ref={resumeInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => handleResumeFileSelected(e.target.files)}
              />

              {!resumeFileName ? (
                <button
                  className="icon-button"
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={resumeUploading}
                >
                  {resumeUploading ? "Reading PDF..." : "📄 Upload Resume (PDF)"}
                </button>
              ) : (
                <div className="composer-chip">
                  <span className="composer-chip-link">
                    ✅ {resumeFileName}
                  </span>
                  <button
                    className="composer-chip-remove"
                    onClick={clearResume}
                    aria-label="Remove resume"
                  >
                    ✕
                  </button>
                </div>
              )}

              {resumeError && (
                <p className="finished-text" style={{ color: "#ff6b6b" }}>
                  ⚠️ {resumeError}
                </p>
              )}

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
                <button className="icon-button" onClick={() => setPhase("chat")}>
                  ← Back
                </button>
                <button
                  className="primary-button"
                  onClick={beginInterview}
                  disabled={startingInterview || !resumeText.trim() || !role.trim()}
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