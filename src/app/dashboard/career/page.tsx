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

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userMessage,
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

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Something went wrong. Please try again.",
        },
      ]);
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

        <div className="messages-area">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "assistant"
                  ? "ai-message"
                  : "user-message"
              }
            >
              {message.text}
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

          <button onClick={sendMessage}>
             {loading ? "..." : "Send"}
          </button>

        </div>

      </div>
    </main>
  );
}
    