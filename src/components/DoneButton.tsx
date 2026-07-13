"use client";

type DoneButtonProps = {
  onDone: () => void;
  disabled?: boolean;
};

export default function DoneButton({
  onDone,
  disabled = false,
}: DoneButtonProps) {
  return (
    <button
      onClick={onDone}
      disabled={disabled}
      className="
      mt-6
      px-6
      py-3
      rounded-xl
      bg-emerald-500
      hover:bg-emerald-400
      transition
      text-black
      font-bold
      shadow-lg
      disabled:opacity-50
      disabled:cursor-not-allowed
      "
    >
      ✅ Done
    </button>
  );
}