"use client";

import Image from "next/image";

export default function CareerPage() {
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

      {/* Chat Overlay */}
      <div className="career-overlay">

        {/* Messages Area */}
        <div className="messages-area">
          <div className="ai-message">
            👋 Welcome to Career & Skill Learning.

            <br /><br />

            Tell me what you'd like to learn today.

            <br />

            I can create a complete personalized roadmap, explain concepts,
            generate projects, review your code, and help you become job-ready.
          </div>
        </div>

        {/* Input */}
        <div className="chat-input">

          <textarea
            placeholder="Ask anything... Example: Teach me Java from beginner to advanced."
          />

          <button>
            Send
          </button>

        </div>

      </div>

    </main>
  );
}