"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ color: "#ff6b6b", marginBottom: "16px" }}>
        ⚠️ Something broke on this page
      </h1>
      <p style={{ maxWidth: "600px", marginBottom: "8px" }}>
        {error.message || "Unknown error"}
      </p>
      {error.digest && (
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "24px" }}>
          Digest: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          padding: "12px 24px",
          background: "#00ff99",
          color: "#000",
          border: "none",
          borderRadius: "10px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}