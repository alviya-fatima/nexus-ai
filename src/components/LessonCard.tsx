"use client";

type LessonCardProps = {
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
  miniTask: string;
  onDone: () => void;
};

export default function LessonCard({
  title,
  whatYouLearn,
  whyImportant,
  whatToDo,
  miniTask,
  onDone,
}: LessonCardProps) {
  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl border border-cyan-500/40 bg-black/70 backdrop-blur-xl shadow-[0_0_30px_rgba(0,200,255,0.15)] p-8 mt-6">

      <h1 className="text-3xl font-bold text-cyan-400 mb-8">
        📚 {title}
      </h1>

      <div className="space-y-8">

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            📖 What You'll Learn
          </h2>

          <p className="text-gray-300">
            {whatYouLearn}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            💡 Why It's Important
          </h2>

          <p className="text-gray-300">
            {whyImportant}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            📝 What To Do
          </h2>

          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            {whatToDo.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            🎯 Mini Task
          </h2>

          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-200">
            {miniTask}
          </div>
        </div>

      </div>

      <button
        onClick={onDone}
        className="mt-10 w-full rounded-xl bg-cyan-500 py-4 text-lg font-bold text-black hover:bg-cyan-400 transition"
      >
        ✅ Done
      </button>

    </div>
  );
}