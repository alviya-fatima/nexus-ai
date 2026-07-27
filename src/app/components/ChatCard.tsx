"use client";

import { useRouter } from "next/navigation";

type ChatCardProps = {
  id: string;
  title: string;
  description: string | null;
  feature: string;
  sessionId: string;
};

export default function ChatCard({
  title,
  description,
  feature,
  sessionId,
}: ChatCardProps) {
  const router = useRouter();

  return (
    <div
      className="chat-card"
      onClick={() => router.push(`/dashboard/${feature}?session=${sessionId}`)}
    >
      <h3 className="chat-card-title">{title}</h3>
      {description && <p className="chat-card-description">{description}</p>}
    </div>
  );
}