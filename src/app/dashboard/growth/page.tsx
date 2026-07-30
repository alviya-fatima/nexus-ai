"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import {
  getGrowthData,
  GrowthPoint,
  GROWTH_FEATURES,
} from "../../../lib/growth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function GrowthPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [points, setPoints] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  async function selectFeature(featureId: string) {
    if (!user) return;
    setSelectedFeature(featureId);
    setLoading(true);
    setPoints([]);

    const data = await getGrowthData(user.uid, featureId);
    setPoints(data);
    setLoading(false);
  }

  function backToPicker() {
    setSelectedFeature(null);
    setPoints([]);
  }

  const activeFeature = GROWTH_FEATURES.find((f) => f.id === selectedFeature);

  const chartData = points.map((p) => ({
    ...p,
    dateLabel: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <main className="career-page">
      <Image
        src="/chat-area-v2.png"
        alt="Growth Background"
        fill
        priority
        className="career-background"
      />

      <div className="career-overlay">
        <div className="career-container">
          {!selectedFeature && (
            <div className="roadmap-card">
              <h1>📈 Your Growth</h1>
              <p className="roadmap-intro">
                Pick what you want to see your progress on.
              </p>

              <div className="tone-options">
                {GROWTH_FEATURES.map((f) => (
                  <button
                    key={f.id}
                    className="tone-option"
                    onClick={() => selectFeature(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedFeature && (
            <div className="roadmap-card">
              <div className="composer-toolbar">
                <button className="icon-button" onClick={backToPicker}>
                  ← Back
                </button>
                <h1 style={{ margin: 0 }}>{activeFeature?.label}</h1>
              </div>

              {loading && <p className="loading-text">Loading your growth data...</p>}

              {!loading && points.length === 0 && (
                <p className="roadmap-intro">
                  No data yet for this — go use this feature a bit, then come
                  back to see your growth here.
                </p>
              )}

              {!loading && points.length > 0 && (
                <>
                  <div style={{ width: "100%", height: 300, marginTop: 16 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,153,0.15)" />
                        <XAxis dataKey="dateLabel" stroke="#aaa" fontSize={12} />
                        <YAxis stroke="#aaa" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            background: "#0d0d0d",
                            border: "1px solid #00ff99",
                            borderRadius: 8,
                            color: "white",
                          }}
                          labelFormatter={(label, payload) =>
                            payload?.[0]?.payload?.label ?? label
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#00ff99"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "#00ff99" }}
                          name={activeFeature?.yAxisLabel}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <h2 style={{ marginTop: 20 }}>📋 Session Details</h2>
                  <div className="roadmap-list">
                    {points.map((p, i) => (
                      <div key={i} className="roadmap-step">
                        {new Date(p.date).toLocaleDateString()} — {p.label}:{" "}
                        <strong>{p.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}