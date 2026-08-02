"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import { auth } from "../../../firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";

import {
  ChatMessage,
  ChatSession,
  getChat,
  makeTitleFromText,
  saveChat,
} from "../../../../lib/chatStorage";

export default function CareerChatPage() {
  const router = useRouter();
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;

  const [user, setUser] = useState<User | null>(null);
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const chatRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

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
    if (!user || !chatId) return;

    const existing = getChat(user.uid, chatId);

    if (!existing) {
      router.push("/dashboard");
      return;
    }

    setChat(existing);
    setLoadingChat(false);
  }, [user, chatId, router]);

  function persist(updated: ChatSession) {
    if (!user) return;
    setChat(updated);
    saveChat(user.uid, updated);
  }

  async function sendMessage() {
    if (!input.trim() || sending || !chat || !user) return;

    const userMessage = input;
    const isFirstUserPrompt = !chat.messages.some((m) => m.role === "user");

    const withUserMessage: ChatSession = {
      ...chat,
      messages: [
        ...chat.messages,
        { role: "user", text: userMessage } as ChatMessage,
        { role: "assistant", text: "" } as ChatMessage,
      ],
    };

    persist(withUserMessage);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

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

${data.lesson.whatToDo.map((item: string) => `• ${item}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━

🎯 Mini Task

${data.lesson.miniTask}

━━━━━━━━━━━━━━━━━━━━━━

When you've finished this lesson,
press the Done button.
`;

      const current = chatRef.current ?? withUserMessage;
      const messages = [...current.messages];
      messages[messages.length - 1] = { role: "assistant", text: lessonText };

      const title =
        isFirstUserPrompt && !current.titleIsAuto
          ? makeTitleFromText(data.goal || userMessage)
          : current.title;

      persist({
        ...current,
        title,
        titleIsAuto: isFirstUserPrompt ? true : current.titleIsAuto,
        messages,
        roadmap: { goal: data.goal, steps: data.roadmap },
      });
    } catch (error) {
      console.error(error);

      const current = chatRef.current ?? withUserMessage;
      const messages = [...current.messages];
      messages[messages.length - 1] = {
        role: "assistant",
        text: "Something went wrong. Please try again.",
      };

      persist({ ...current, messages });
    }

    setSending(false);
  }

  if (loadingChat || !chat) {
    return (
      <main className="career-page">
        <div className="career-loading">Loading chat…</div>
      </main>
    );
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

      <button
        className="chat-back-button"
        onClick={() => router.push("/dashboard")}
      >
        ← Dashboard
      </button>

      <div className="career-overlay">
        {chat.roadmap && (
          <div className="roadmap-card">
            <h2>🎯 {chat.roadmap.goal}</h2>

            <h3>🗺️ Learning Roadmap</h3>

            <div className="roadmap-list">
              {chat.roadmap.steps.map((step, index) => (
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
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              🚀 Start Step 1
            </button>
          </div>
        )}

        <div className="messages-area">
          {chat.messages.map((message, index) => (
            <div
              key={index}
              className={`message-row ${
                message.role === "user" ? "user-row" : "assistant-row"
              }`}
            >
              {message.role === "assistant" && (
                <div className="avatar ai-avatar">N</div>
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
                <div className="avatar user-avatar">A</div>
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

          <button onClick={sendMessage} disabled={sending}>
            {sending ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}