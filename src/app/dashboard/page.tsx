"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import dashboard from "../../assets/dashboard.png";

import { auth } from "../firebase/config";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

import CreateProjectPopup from "../components/CreateProjectPopup";
import ChatCard from "../components/ChatCard";
import { supabase } from "../../lib/supabaseClient";

type ChatHistoryRow = {
  id: string;
  title: string;
  description: string | null;
  feature: string;
  session_id: string;
  created_at: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [chats, setChats] = useState<ChatHistoryRow[]>([]);

  const fetchChats = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setChats(data ?? []);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchChats(currentUser.uid);
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router, fetchChats]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  const latestChat = chats[0];

  return (
    <main className="dashboard-page">
      <Image
        src={dashboard}
        alt="Dashboard"
        fill
        priority
        quality={100}
        className="dashboard-image"
      />

      {/* Latest chat, centered */}
      {latestChat && !popupOpen && (
        <div className="dashboard-center-chat">
          <ChatCard
            id={latestChat.id}
            title={latestChat.title}
            description={latestChat.description}
            feature={latestChat.feature}
            sessionId={latestChat.session_id}
          />
        </div>
      )}

      {!popupOpen && (
        <>
          <button className="search-button">
            <Image
              src="/search-bar.png"
              alt="Search"
              width={500}
              height={70}
              priority
              className="search-bar-image"
            />
          </button>

          <button className="per-growth-button">
            <Image
              src="/per-grow.png"
              alt="Per Growth"
              width={250}
              height={70}
              priority
              className="per-growth-image"
            />
          </button>

          <button
            className="create-project-button"
            onClick={() => setPopupOpen(true)}
          >
            <Image
              src="/create-btn.png"
              alt="Create Project"
              width={260}
              height={75}
              priority
              className="create-project-image"
            />
          </button>
        </>
      )}

      <CreateProjectPopup
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
        onCreated={() => user && fetchChats(user.uid)}
      />

      {user?.photoURL && (
        <div className="profile-container">
          <Image
            src={user.photoURL}
            alt="Profile"
            width={140}
            height={140}
            unoptimized
            className="profile-picture"
          />
        </div>
      )}

      <button onClick={logout} className="logout-button">
        <Image
          src="/google-logout-btn.png"
          alt="Logout"
          width={220}
          height={60}
          priority
          className="logout-button-image"
        />
      </button>
    </main>
  );
}