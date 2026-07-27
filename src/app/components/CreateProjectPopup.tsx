"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { auth } from "../firebase/config";

type CreateProjectPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateProjectPopup({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectPopupProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const createCareerChat = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError("You must be logged in.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Create the underlying task session
      const { data: session, error: sessionError } = await supabase
        .from("task_sessions")
        .insert({
          user_id: uid,
          task: "career",
          goal: name.trim(),
        })
        .select()
        .single();

      if (sessionError || !session) throw sessionError;

      // 2. Create the chat_history entry pointing at it
      const { error: historyError } = await supabase
        .from("chat_history")
        .insert({
          user_id: uid,
          feature: "career",
          title: name.trim(),
          description: description.trim() || null,
          session_table: "task_sessions",
          session_id: session.id,
        });

      if (historyError) throw historyError;

      onCreated?.();
      onClose();
      router.push(`/dashboard/career?session=${session.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()}>
        <Image
          src="/create-popup.png"
          alt="Create Project Popup"
          width={700}
          height={500}
          priority
          className="popup-image"
        />

        {/* Name / description inputs */}
        <input
          type="text"
          placeholder="Chat name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="popup-input popup-input-name"
        />
        <input
          type="text"
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="popup-input popup-input-description"
        />

        {error && <p className="popup-error">{error}</p>}

        {/* Button 1 - Career & Skill Learning */}
        <button
          className="popup-btn btn1"
          onClick={createCareerChat}
          disabled={saving}
        >
          <Image
            src="/btn1.png"
            alt="Career & Skill Learning"
            width={260}
            height={60}
            priority
          />
        </button>

        <button className="popup-btn btn2">
          <Image src="/btn2.png" alt="Button 2" width={260} height={60} priority />
        </button>

        <button className="popup-btn btn3">
          <Image src="/btn3.png" alt="Button 3" width={260} height={60} priority />
        </button>

        <button className="popup-btn btn4">
          <Image src="/btn4.png" alt="Button 4" width={260} height={60} priority />
        </button>

        <button className="popup-btn btn5">
          <Image src="/btn5.png" alt="Button 5" width={260} height={60} priority />
        </button>

        <button className="popup-close-button" onClick={onClose}>
          <Image
            src="/cancel-btn.png"
            alt="Close"
            width={55}
            height={55}
            priority
            className="cancel-button-image"
          />
        </button>
      </div>
    </div>
  );
}