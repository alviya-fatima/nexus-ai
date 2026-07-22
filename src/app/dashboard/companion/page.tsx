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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // Interview setup — resume is a PDF upload, not a text box
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Entry-level");
  const [startingInterview, setStartingInterview] = useState(false);

  // Interview in progress — fully voice-driven, no text/manual submit
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<QAPair[]>([]);
  const [interviewVoiceStatus, setInterviewVoiceStatus] =
    useState<VoiceStatus>("idle");
  const interviewActiveRef = useRef(false);
  const questionsRef = useRef<string[]>([]);
  const currentQuestionIndexRef = useRef(0);

  // Report
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Listening (native SpeechRecognition OR universal mic-recording fallback)
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const silenceRafRef = useRef<number | null>(null);

  // Speaking (Gemini TTS played through a plain <audio> element)
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    const hasNative = !!getSpeechRecognition();
    const hasFallback =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof window.MediaRecorder !== "undefined";
    setVoiceSupported(hasNative || hasFallback);
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

  // ---------------- Speaking: always via Gemini TTS + <audio> (universal) ----------------

  async function speak(text: string, onEnd?: () => void) {
    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "speak", text }),
      });

      const data = await res.json();

      if (!data.audioBase64) {
        onEnd?.();
        return;
      }

      const audio = new Audio(data.audioBase64);
      audioRef.current = audio;
      audio.onended = () => onEnd?.();
      audio.onerror = () => onEnd?.();
      await audio.play();
    } catch (error) {
      console.error("Speak failed:", error);
      onEnd?.();
    }
  }

  function stopSpeaking() {
    audioRef.current?.pause();
    audioRef.current = null;
  }

  // ---------------- Listening: native SpeechRecognition, else universal mic + Gemini ----------------

  async function transcribeBlob(blob: Blob): Promise<string> {
    const dataUrl = await blobToDataUrl(blob);
    const res = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "transcribe",
        audioBase64: dataUrl,
        mimeType: blob.type,
      }),
    });
    const data = await res.json();
    return data.text ?? "";
  }

  async function recordWithSilenceDetection(
    onFinalTranscript: (text: string) => void
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);

        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });

        try {
          const text = await transcribeBlob(blob);
          onFinalTranscript(text);
        } catch (err) {
          console.error(err);
          onFinalTranscript("");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      let silenceStart: number | null = null;
      const SILENCE_RMS_THRESHOLD = 10;
      const SILENCE_DURATION_MS = 1400;
      const startedAt = Date.now();

      function checkVolume() {
        analyser.getByteTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] - 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms < SILENCE_RMS_THRESHOLD) {
          if (silenceStart === null) silenceStart = Date.now();
          else if (
            Date.now() - silenceStart > SILENCE_DURATION_MS &&
            Date.now() - startedAt > 800
          ) {
            if (recorder.state !== "inactive") recorder.stop();
            return;
          }
        } else {
          silenceStart = null;
        }

        if (Date.now() - startedAt > 25000) {
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }

        silenceRafRef.current = requestAnimationFrame(checkVolume);
      }

      checkVolume();
    } catch (err) {
      console.error("Microphone access failed:", err);
      onFinalTranscript("");
    }
  }

  function listen(onFinalTranscript: (text: string) => void) {
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        onFinalTranscript(result[0].transcript);
      };
      recognition.onerror = () => onFinalTranscript("");

      recognitionRef.current = recognition;
      recognition.start();
      return;
    }

    // Universal fallback: record until silence, then transcribe via Gemini
    recordWithSilenceDetection(onFinalTranscript);
  }

  function stopListen() {
    recognitionRef.current?.stop();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  // ---------------- General voice-only chat (continuous loop) ----------------

  function startVoiceChat() {
    voiceChatActiveRef.current = true;
    setVoiceChatActive(true);
    setVoiceStatus("listening");
    listen(handleUserSpeech);
  }

  function stopVoiceChat() {
    voiceChatActiveRef.current = false;
    setVoiceChatActive(false);
    setVoiceStatus("idle");
    stopListen();
    stopSpeaking();
  }

  async function handleUserSpeech(text: string) {
    if (!text.trim()) {
      if (voiceChatActiveRef.current) {
        setVoiceStatus("listening");
        listen(handleUserSpeech);
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
          listen(handleUserSpeech);
        } else {
          setVoiceStatus("idle");
        }
      });
    } catch (error) {
      console.error(error);
      if (voiceChatActiveRef.current) {
        setVoiceStatus("listening");
        listen(handleUserSpeech);
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

  // ---------------- Mock interview flow (fully voice-driven) ----------------

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

      questionsRef.current = data.questions;
      currentQuestionIndexRef.current = 0;

      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setTranscript([]);
      setReport(null);
      setPhase("interviewing");
      interviewActiveRef.current = true;

      setInterviewVoiceStatus("speaking");
      speak(data.introMessage, () => {
        askQuestion(0);
      });
    } catch (error) {
      console.error(error);
    }

    setStartingInterview(false);
  }

  function askQuestion(index: number) {
    if (!interviewActiveRef.current) return;

    const q = questionsRef.current[index];
    if (!q) return;

    setInterviewVoiceStatus("speaking");
    speak(q, () => {
      if (!interviewActiveRef.current) return;
      setInterviewVoiceStatus("listening");
      listen(handleInterviewAnswer);
    });
  }

  function handleInterviewAnswer(text: string) {
    if (!interviewActiveRef.current) return;

    if (!text.trim()) {
      setInterviewVoiceStatus("listening");
      listen(handleInterviewAnswer);
      return;
    }

    setInterviewVoiceStatus("thinking");

    const index = currentQuestionIndexRef.current;
    const question = questionsRef.current[index];

    setTranscript((prev) => {
      const updated = [...prev, { question, answer: text }];

      const nextIndex = index + 1;
      if (nextIndex >= questionsRef.current.length) {
        interviewActiveRef.current = false;
        generateReport(updated);
      } else {
        currentQuestionIndexRef.current = nextIndex;
        setCurrentQuestionIndex(nextIndex);
        askQuestion(nextIndex);
      }

      return updated;
    });
  }

  async function generateReport(finalTranscript: QAPair[]) {
    interviewActiveRef.current = false;
    stopListen();
    stopSpeaking();
    setInterviewVoiceStatus("idle");
    setReportLoading(true);
    setPhase("report");

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
    interviewActiveRef.current = false;
    stopListen();
    stopSpeaking();

    setPhase("chat");
    setMessages([]);
    clearResume();
    setRole("");
    setExperienceLevel("Entry-level");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTranscript([]);
    setInterviewVoiceStatus("idle");
    setReport(null);
  }

  const voiceStatusLabel: Record<VoiceStatus, string> = {
    idle: "🎤 Start Voice Chat",
    listening: "🎙️ Listening...",
    thinking: "🤔 Thinking...",
    speaking: "🔊 Speaking...",
  };

  const interviewStatusLabel: Record<VoiceStatus, string> = {
    idle: "",
    listening: "🎙️ Listening for your answer...",
    thinking: "🤔 Processing your answer...",
    speaking: "🔊 Asking the question...",
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
                ⚠️ This browser doesn't support microphone access. Please use
                a modern browser (Chrome, Edge, Firefox, or Safari) for the
                voice experience.
              </p>
            </div>
          )}

          {/* ---------------- CHAT PHASE (voice only) ---------------- */}
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
                Give NEXUS AI what it needs to run a realistic, tailored,
                fully voice-driven interview.
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

          {/* ---------------- INTERVIEWING PHASE (voice only) ---------------- */}
          {phase === "interviewing" && (
            <div className="roadmap-card">
              <h1>🎯 Mock Interview: {role}</h1>
              <p className="roadmap-intro">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>

              <div
                className={`mic-button ${
                  interviewVoiceStatus !== "idle" ? "mic-button-listening" : ""
                }`}
                style={{ pointerEvents: "none" }}
              >
                🎙️
              </div>

              <p className="voice-status-text">
                {interviewStatusLabel[interviewVoiceStatus]}
              </p>

              <button className="secondary-button" onClick={endInterviewEarly}>
                ⏹️ End Interview Now
              </button>
            </div>
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