"use client";

type LessonViewProps = {
  title: string;
  whatYouLearn: string;
  whyImportant: string;
  whatToDo: string[];
  miniTask: string;

  question: string;
  setQuestion: (value: string) => void;

  onAsk: () => void;
  onDone: () => void;
};

export default function LessonView({
  title,
  whatYouLearn,
  whyImportant,
  whatToDo,
  miniTask,
  question,
  setQuestion,
  onAsk,
  onDone,
}: LessonViewProps) {
  return (
    <div className="lesson-screen">

      <div className="lesson-card">

        <h1>{title}</h1>

        <section>
          <h2>📚 What You'll Learn</h2>
          <p>{whatYouLearn}</p>
        </section>

        <section>
          <h2>💡 Why It's Important</h2>
          <p>{whyImportant}</p>
        </section>

        <section>
          <h2>📝 What To Do</h2>

          <ul>
            {whatToDo.map((task, index) => (
              <li key={index}>{task}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>🎯 Mini Task</h2>
          <p>{miniTask}</p>
        </section>

        <hr />

        <h2>Questions about this lesson?</h2>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this lesson..."
        />

        <button onClick={onAsk}>
          Ask NEXUS AI
        </button>

        <button onClick={onDone}>
          ✅ Done
        </button>

      </div>

    </div>
  );
}