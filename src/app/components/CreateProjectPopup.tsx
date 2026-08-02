"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { auth } from "../firebase/config";
import { createChat } from "../../lib/chatStorage";

type CreateProjectPopupProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateProjectPopup({
  isOpen,
  onClose,
}: CreateProjectPopupProps) {
  const router = useRouter();

  if (!isOpen) return null;

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

        <button
          className="popup-btn btn1"
          onClick={() => {
            onClose();

            const uid = auth.currentUser?.uid;
            if (!uid) {
              router.push("/");
              return;
            }

            const chat = createChat(uid);
            router.push(`/dashboard/career/${chat.id}`);
          }}
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