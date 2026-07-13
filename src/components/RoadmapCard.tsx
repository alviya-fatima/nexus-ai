"use client";

type Props = {
  goal: string;
  steps: string[];
  onStart: () => void;
};

export default function RoadmapCard({
  goal,
  steps,
  onStart,
}: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-emerald-500 bg-[#0b0b0b]/90 backdrop-blur-xl p-8 shadow-[0_0_30px_rgba(0,255,170,.15)]">

      <div className="text-3xl font-bold text-emerald-400 mb-6">
        🎯 {goal}
      </div>

      <div className="text-xl font-semibold text-white mb-4">
        🗺️ Learning Roadmap
      </div>

      <div className="space-y-3">

        {steps.map((step, index) => (
          <div
            key={index}
            className="
            rounded-xl
            border
            border-emerald-500/30
            bg-[#111]
            px-5
            py-4
            text-white
            text-lg
            "
          >
            {index === 0 ? "✅" : "⬜"} {step}
          </div>
        ))}

      </div>

      <button
        onClick={onStart}
        className="
        mt-8
        w-full
        rounded-xl
        bg-emerald-500
        hover:bg-emerald-400
        text-black
        font-bold
        py-4
        text-lg
        transition
        "
      >
        🚀 Start Step 1
      </button>

    </div>
  );
}