"use client";

import { useState } from "react";
import Image from "next/image";

export default function CareerPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "What kind of skill are you trying to learn or master today?",
    },
  ]);

  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: input,
      },
    ]);

    setInput("");
  };

  return (
    <main className="career-page">
      {/* Background */}

      <Image
        src="/chat-area.png"
        alt="Career Background"
        fill
        priority
        quality={100}
        className="career-background"
      />

      <div className="career-overlay">
        {/* Messages */}

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

        {/* Chat Input */}

        <div className="chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type what you want to learn..."
          />

          <button onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </main>
  );
}