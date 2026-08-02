"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { auth } from "../../../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import { createChat } from "../../../../lib/chatStorage";

// Visiting /dashboard/career directly (no chat id) always starts a fresh chat
// and hands off to the real per-chat page at /dashboard/career/[chatId].
export default function CareerRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }

      const chat = createChat(currentUser.uid);
      router.replace(`/dashboard/career/${chat.id}`);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <main className="career-page">
      <div className="career-loading">Starting a new chat…</div>
    </main>
  );
}