"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { jsPDF } from "jspdf";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import { supabase } from "../../../lib/supabaseClient";

type BudgetItem = {
  item: string;
  cheapOption: string;
  estimatedCost: string;
  whereToBuy: string;
};

type ResearchSource = {
  name: string;
  url: string;
  whatYoullFind: string;
};

type Plan = {
  title: string;
  summary: string;
  budgetOptions: BudgetItem[];
  stepByStep: string[];
  researchSources: ResearchSource[];
  researchSummary: string;
  designIdeas: string[];
};

type ChatEntry = { question: string; answer: string };

type DesignImageState = {
  loading: boolean;
  dataUrl: string | null;
  error: string | null;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProjectStudioPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [brief, setBrief] = useState("");
  const [requirements, setRequirements] = useState("");
  const [loading, setLoading] = useState(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [designImages, setDesignImages] = useState<DesignImageState[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const sessionIdRef = useRef<string>(makeId());

  const started = !!plan;

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
    if (!plan || !user) return;

    const saveSession = async () => {
      try {
        await supabase.from("task_sessions").upsert(
          {
            id: sessionIdRef.current,
            user_id: user.uid,
            task: brief,
            goal: plan.title,
            roadmap: plan.stepByStep,
            session_data: { plan, chat },
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
  }, [plan, chat, user]);

  async function generatePlan() {
    if (!brief.trim() || !requirements.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/project-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          brief,
          requirements,
          userId: user?.uid,
        }),
      });

      const data: Plan = await res.json();
      setPlan(data);
      setDesignImages(
        data.designIdeas.map(() => ({ loading: false, dataUrl: null, error: null }))
      );
      setChat([]);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  async function askQuestion() {
    if (!question.trim() || asking || !plan) return;

    const askedQuestion = question;
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch("/api/project-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "question",
          title: plan.title,
          question: askedQuestion,
          userId: user?.uid,
        }),
      });

      const data = await res.json();
      setChat((prev) => [...prev, { question: askedQuestion, answer: data.reply ?? "" }]);
    } catch (error) {
      console.error(error);
    }

    setAsking(false);
  }

  async function generateDesignImage(index: number) {
    if (!plan) return;

    setDesignImages((prev) =>
      prev.map((d, i) => (i === index ? { ...d, loading: true, error: null } : d))
    );

    try {
      const res = await fetch("/api/project-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_image",
          prompt: plan.designIdeas[index],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDesignImages((prev) =>
          prev.map((d, i) =>
            i === index ? { ...d, loading: false, error: data.error ?? "Failed to generate image." } : d
          )
        );
        return;
      }

      setDesignImages((prev) =>
        prev.map((d, i) => (i === index ? { loading: false, dataUrl: data.imageDataUrl, error: null } : d))
      );
    } catch (error) {
      console.error(error);
      setDesignImages((prev) =>
        prev.map((d, i) => (i === index ? { ...d, loading: false, error: "Failed to generate image." } : d))
      );
    }
  }

  async function downloadPdf() {
    if (!plan) return;
    setGeneratingPdf(true);

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      let y = 50;

      function addWrapped(text: string, fontSize: number, bold = false) {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (y > 780) {
            doc.addPage();
            y = 50;
          }
          doc.text(line, margin, y);
          y += fontSize * 1.3;
        });
        y += 6;
      }

      addWrapped(plan.title, 20, true);
      addWrapped(plan.summary, 11);

      addWrapped("Budget-Friendly Materials", 14, true);
      plan.budgetOptions.forEach((b) => {
        addWrapped(
          `• ${b.item}: ${b.cheapOption} (~${b.estimatedCost}) — ${b.whereToBuy}`,
          10
        );
      });

      addWrapped("Step-by-Step Guide", 14, true);
      plan.stepByStep.forEach((s, i) => {
        addWrapped(`${i + 1}. ${s}`, 10);
      });

      addWrapped("Research Sources", 14, true);
      plan.researchSources.forEach((r) => {
        addWrapped(`• ${r.name} (${r.url}) — ${r.whatYoullFind}`, 10);
      });

      addWrapped("Research Summary", 14, true);
      addWrapped(plan.researchSummary, 10);

      const generatedDesigns = designImages.filter((d) => d.dataUrl);
      if (generatedDesigns.length > 0) {
        addWrapped("Design Concepts", 14, true);
        for (const design of generatedDesigns) {
          if (y > 550) {
            doc.addPage();
            y = 50;
          }
          if (design.dataUrl) {
            doc.addImage(design.dataUrl, "PNG", margin, y, 240, 240);
            y += 260;
          }
        }
      }

      doc.save(`${plan.title.replace(/[^\w\s-]/g, "").trim() || "project-summary"}.pdf`);
    } catch (error) {
      console.error(error);
    }

    setGeneratingPdf(false);
  }

  return (
    <main className="career-page">
      <Image
        src="/chat-area-v2.png"
        alt="Project Studio Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!started && (
            <div className="skill-screen">
              <h1>What do you want to make?</h1>
              <p className="skill-subtitle">
                Tell NEXUS AI what you're building or presenting — it'll plan
                the whole thing: cheap materials, step-by-step build
                instructions, research, design concepts, and a downloadable
                PDF summary.
              </p>

              <p className="step-ask-box-label">What is it, and what's the situation?</p>
              <textarea
                value={brief}
                placeholder="Example: I have a math presentation due in 3 days and haven't started..."
                onChange={(e) => setBrief(e.target.value)}
              />

              <p className="step-ask-box-label">What requirements does it have to match?</p>
              <textarea
                value={requirements}
                placeholder="Example: Must be 10 minutes long, cover derivatives, include a visual aid, budget under $20..."
                onChange={(e) => setRequirements(e.target.value)}
              />

              <button
                className="primary-button"
                onClick={generatePlan}
                disabled={loading}
              >
                {loading ? "Planning..." : "🚀 Generate Plan"}
              </button>
            </div>
          )}

          {started && plan && (
            <>
              <div className="roadmap-card">
                <h1>🎯 {plan.title}</h1>
                <p className="roadmap-intro">{plan.summary}</p>
                <button
                  className="secondary-button"
                  onClick={downloadPdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? "Building PDF..." : "📄 Download PDF Summary"}
                </button>
              </div>

              <div className="lesson-feed-card">
                <div className="steps-feed">
                  <div className="step-lesson-box">
                    <h2>💰 Budget-Friendly Materials</h2>
                    <div className="lesson-bubble bubble-learn">
                      <ul>
                        {plan.budgetOptions.map((b, i) => (
                          <li key={i}>
                            <strong>{b.item}:</strong> {b.cheapOption} (~{b.estimatedCost}) —{" "}
                            {b.whereToBuy}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <h2>🛠️ Step-by-Step Guide</h2>
                    <div className="lesson-bubble bubble-todo">
                      <ul>
                        {plan.stepByStep.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <h2>🔍 Research Sources</h2>
                    <div className="lesson-bubble bubble-why">
                      <ul>
                        {plan.researchSources.map((r, i) => (
                          <li key={i}>
                            <a
                              href={
                                r.url.startsWith("http") ? r.url : `https://${r.url}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gpt-attachment-link"
                            >
                              {r.name}
                            </a>{" "}
                            — {r.whatYoullFind}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <h2>📚 Research Summary</h2>
                    <div className="lesson-bubble bubble-learn">
                      <p>{plan.researchSummary}</p>
                    </div>

                    <h2>🎨 Design Concepts</h2>
                    <div className="vocab-grid">
                      {plan.designIdeas.map((idea, i) => (
                        <div key={i} className="vocab-card">
                          <div className="vocab-meaning">{idea}</div>
                          {designImages[i]?.dataUrl ? (
                            <img
                              src={designImages[i].dataUrl!}
                              alt={idea}
                              className="design-generated-image"
                            />
                          ) : (
                            <button
                              className="vocab-play-button"
                              onClick={() => generateDesignImage(i)}
                              disabled={designImages[i]?.loading}
                            >
                              {designImages[i]?.loading
                                ? "Generating..."
                                : "🎨 Generate Image"}
                            </button>
                          )}
                          {designImages[i]?.error && (
                            <p className="quiz-explanation">
                              ⚠️ {designImages[i].error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="step-ask-box">
                    <h3 className="ask-heading">💬 Ask anything about this plan</h3>

                    {chat.length > 0 && (
                      <div className="gpt-thread">
                        {chat.map((entry, i) => (
                          <div key={i} className="gpt-exchange">
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

                    <textarea
                      value={question}
                      placeholder="Ask about this plan..."
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
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}