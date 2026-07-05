"use client";

import Image from "next/image";
import dashboard from "../../assets/dashboard.png";

export default function Dashboard() {
  return (
    <main className="dashboard-page">
      <Image
        src={dashboard}
        alt="NEXUS AI Dashboard"
        fill
        priority
        quality={100}
        sizes="100vw"
        className="dashboard-image"
      />
    </main>
  );
}