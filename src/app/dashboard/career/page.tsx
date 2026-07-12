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

    // Add user message + empty AI message
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

      if (!res.body) {
        throw new Error("No response body.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let aiReply = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        aiReply += decoder.decode(value);

        setMessages((prev) => {
          const updated = [...prev];

          updated[updated.length - 1] = {
            role: "assistant",
            text: aiReply,
          };

          return updated;
        });
      }
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