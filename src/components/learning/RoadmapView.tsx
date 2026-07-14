"use client";

type RoadmapViewProps = {
  goal: string;
  roadmap: string[];
  onStart: () => void;
};

export default function RoadmapView({
  goal,
  roadmap,
  onStart,
}: RoadmapViewProps) {
  return (
    <div className="roadmap-screen">

      <div className="roadmap-card">

        <h1>🎯 {goal}</h1>

        <h2>🗺️ Learning Roadmap</h2>

        <div className="roadmap-steps">
          {roadmap.map((step, index) => (
            <div
              key={index}
              className="roadmap-step"
            >
              <span>
                {index === 0 ? "✅" : "⬜"}
              </span>

              <span>{step}</span>
            </div>
          ))}
        </div>

        <button
          className="start-learning-button"
          onClick={onStart}
        >
          🚀 Start Learning
        </button>

      </div>

    </div>
  );
}