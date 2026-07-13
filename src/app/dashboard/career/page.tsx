"use client";

import { useState } from "react";
import Image from "next/image";

type Message = {
  role: "assistant" | "user";
  text: string;
};

export default function CareerPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "What kind of skill are you trying to learn or master today?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [roadmap, setRoadmap] = useState<{
    goal: string;
    steps: string[];
  } | null>(null);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input;

   
    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userMessage,
      },
      {
        role: "assistant",
        text: "",
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

     const data = await res.json();

setRoadmap({
  goal: data.goal,
  steps: data.roadmap,
});

const lessonText = `
📚 ${data.lesson.title}

━━━━━━━━━━━━━━━━━━━━━━

📖 What You'll Learn

${data.lesson.whatYouLearn}

━━━━━━━━━━━━━━━━━━━━━━

💡 Why It's Important

${data.lesson.whyImportant}

━━━━━━━━━━━━━━━━━━━━━━

📝 What To Do

${data.lesson.whatToDo
  .map((item: string) => `• ${item}`)
  .join("\n")}

━━━━━━━━━━━━━━━━━━━━━━

🎯 Mini Task

${data.lesson.miniTask}

━━━━━━━━━━━━━━━━━━━━━━

When you've finished this lesson,
press the Done button.
`;

setMessages((prev) => {
  const updated = [...prev];

  updated[updated.length - 1] = {
    role: "assistant",
    text: lessonText,
  };

  return updated;
});
    } catch (error) {
      console.error(error);

      setMessages((prev) => {
        const updated = [...prev];

        updated[updated.length - 1] = {
          role: "assistant",
          text: "Something went wrong. Please try again.",
        };

        return updated;
      });
    }

    setLoading(false);
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

        {roadmap && (
          <div className="roadmap-card">

            <h2>🎯 {roadmap.goal}</h2>

            <h3>🗺️ Learning Roadmap</h3>

            <div className="roadmap-list">
              {roadmap.steps.map((step, index) => (
                <div key={index} className="roadmap-step">
                  {index === 0 ? "✅" : "⬜"} {step}
                </div>
              ))}
            </div>
<button
  className="start-learning-btn"
  onClick={() => {
    document
      .querySelector(".messages-area")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }}
>
  🚀 Start Step 1
</button>

          </div>
        )}

        <div className="messages-area">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${
                message.role === "user"
                  ? "user-row"
                  : "assistant-row"
              }`}
            >
              {message.role === "assistant" && (
                <div className="avatar ai-avatar">
                  N
                </div>
              )}

              <div
                className={`message-bubble ${
                  message.role === "assistant"
                    ? "assistant-bubble"
                    : "user-bubble"
                }`}
              >
                {message.text}
              </div>

              {message.role === "user" && (
                <div className="avatar user-avatar">
                  A
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="chat-input">

          <textarea
            value={input}
            placeholder="Type what you want to learn..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          <button onClick={sendMessage} disabled={loading}>
            {loading ? "Thinking..." : "Send"}
          </button>

        </div>

      </div>
    </main>
  );
}