"use client";

import Image from "next/image";

type CreateProjectPopupProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CreateProjectPopup({
  isOpen,
  onClose,
}: CreateProjectPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-container"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src="/create-popup.png"
          alt="Create Project Popup"
          width={700}
          height={500}
          priority
          className="popup-image"
        />

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