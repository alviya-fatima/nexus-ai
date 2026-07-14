"use client";

type SkillInputProps = {
  skill: string;
  setSkill: (value: string) => void;
  onGenerate: () => void;
  loading: boolean;
};

export default function SkillInput({
  skill,
  setSkill,
  onGenerate,
  loading,
}: SkillInputProps) {
  return (
    <div className="skill-input-screen">

      <h1>What do you want to learn?</h1>

      <p>
        Tell NEXUS AI any skill and it will build a personalized roadmap.
      </p>

      <textarea
        value={skill}
        onChange={(e) => setSkill(e.target.value)}
        placeholder="Example: Java, Cybersecurity, UI Design..."
      />

      <button
        onClick={onGenerate}
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Roadmap"}
      </button>

    </div>
  );
}