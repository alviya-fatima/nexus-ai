"use client";

import Image from "next/image";
import dashboard from "../../assets/dashboard.png";

export default function Dashboard() {
  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <Image
        src={dashboard}
        alt="Dashboard"
        fill
        priority
        quality={100}
        sizes="100vw"
        style={{
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    </main>
  );
}