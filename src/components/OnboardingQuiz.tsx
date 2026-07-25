"use client";

import { useState } from "react";
import { saveUserProfile, markOnboardingSeen, UserProfile } from "../lib/userProfile";

type Props = {
  userId: string;
  onComplete: () => void;
};

export default function OnboardingQuiz({ userId, onComplete }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [interests, setInterests] = useState("");
  const [favoriteColor, setFavoriteColor] = useState("");
  const [tone, setTone] = useState<UserProfile["tone"]>("normal");
  const [useEmojis, setUseEmojis] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!displayName.trim() || saving) return;
    setSaving(true);

    await saveUserProfile({
      user_id: userId,
      display_name: displayName.trim(),
      age: age.trim(),
      interests: interests.trim(),
      favorite_color: favoriteColor.trim(),
      tone,
      use_emojis: useEmojis,
      onboarded: true,
    });

    setSaving(false);
    onComplete();
  }

  async function handleSkip() {
    if (saving) return;
    setSaving(true);
    await markOnboardingSeen(userId);
    setSaving(false);
    onComplete();
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h1>👋 Welcome to NEXUS AI</h1>
          <button className="onboarding-skip" onClick={handleSkip} disabled={saving}>
            Skip ✕
          </button>
        </div>

        <p className="roadmap-intro">
          Quick setup so NEXUS AI talks to you exactly how you like — takes 30 seconds.
        </p>

        <p className="step-ask-box-label">What should NEXUS AI call you?</p>
        <input
          className="companion-input"
          type="text"
          value={displayName}
          placeholder="Your name or nickname..."
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <p className="step-ask-box-label">How old are you?</p>
        <input
          className="companion-input"
          type="text"
          value={age}
          placeholder="Your age..."
          onChange={(e) => setAge(e.target.value)}
        />

        <p className="step-ask-box-label">What are you into? (hobbies, interests)</p>
        <input
          className="companion-input"
          type="text"
          value={interests}
          placeholder="Example: gaming, basketball, robotics..."
          onChange={(e) => setInterests(e.target.value)}
        />

        <p className="step-ask-box-label">Favorite color?</p>
        <input
          className="companion-input"
          type="text"
          value={favoriteColor}
          placeholder="Example: green..."
          onChange={(e) => setFavoriteColor(e.target.value)}
        />

        <p className="step-ask-box-label">How should NEXUS AI talk to you?</p>
        <div className="tone-options">
          {[
            { value: "gen_z", label: "😎 Gen Z" },
            { value: "expository", label: "📖 Expository" },
            { value: "normal", label: "💬 Normal" },
            { value: "coaching", label: "🏆 Coaching" },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`tone-option ${tone === opt.value ? "tone-option-selected" : ""}`}
              onClick={() => setTone(opt.value as UserProfile["tone"])}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="step-ask-box-label">Emojis in responses?</p>
        <div className="tone-options">
          <button
            className={`tone-option ${useEmojis ? "tone-option-selected" : ""}`}
            onClick={() => setUseEmojis(true)}
          >
            😊 Yes, use emojis
          </button>
          <button
            className={`tone-option ${!useEmojis ? "tone-option-selected" : ""}`}
            onClick={() => setUseEmojis(false)}
          >
            🚫 No emojis
          </button>
        </div>

        <button
          className="primary-button"
          onClick={handleSubmit}
          disabled={!displayName.trim() || saving}
        >
          {saving ? "Saving..." : "✅ Start Using NEXUS AI"}
        </button>
      </div>
    </div>
  );
}