"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

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
    <div
      className="popup-overlay"
      onClick={onClose}
    >
      <div
        className="popup-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Popup Background */}

        <Image
          src="/create-popup.png"
          alt="Create Project Popup"
          width={700}
          height={500}
          priority
          className="popup-image"
        />

        {/* Button 1 - Career & Skill Learning */}

        <button
          className="popup-btn btn1"
          onClick={() => {
            onClose();
            router.push("/dashboard/career");
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

        {/* Button 2 */}

        <button className="popup-btn btn2">
          <Image
            src="/btn2.png"
            alt="Button 2"
            width={260}
            height={60}
            priority
          />
        </button>

        {/* Button 3 */}

        <button className="popup-btn btn3">
          <Image
            src="/btn3.png"
            alt="Button 3"
            width={260}
            height={60}
            priority
          />
        </button>

        {/* Button 4 */}

        <button className="popup-btn btn4">
          <Image
            src="/btn4.png"
            alt="Button 4"
            width={260}
            height={60}
            priority
          />
        </button>

        {/* Button 5 */}

        <button className="popup-btn btn5">
          <Image
            src="/btn5.png"
            alt="Button 5"
            width={260}
            height={60}
            priority
          />
        </button>

        {/* Cancel Button */}

        <button
          className="popup-close-button"
          onClick={onClose}
        >
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