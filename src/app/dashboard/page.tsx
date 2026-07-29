"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dashboard from "../../assets/dashboard.png";
import { auth } from "../firebase/config";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import CreateProjectPopup from "../components/CreateProjectPopup";
import OnboardingQuiz from "../../components/OnboardingQuiz";
import { getUserProfile } from "../../lib/userProfile";
import { fetchChats, ChatEntry } from "../../lib/chats";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  const fetchUserChats = useCallback(async (userId: string) => {
    setChatsLoading(true);
    const data = await fetchChats(userId);
    setChats(data);
    setChatsLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        const profile = await getUserProfile(currentUser.uid);
        setShowOnboarding(!profile || !profile.onboarded);
        setCheckingOnboarding(false);

        fetchUserChats(currentUser.uid);
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router, fetchUserChats]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  function openChat(chat: ChatEntry) {
    router.push(chat.route);
  }

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

      {!popupOpen && !checkingOnboarding && !showOnboarding && (
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
            />
          </button>

          {/* Chat history — appears in the middle of the dashboard */}
          <div className="dashboard-chats-panel">
            <h2>💬 Your Chats</h2>

            {chatsLoading && <p className="loading-text">Loading your chats...</p>}

            {!chatsLoading && chats.length === 0 && (
              <p className="roadmap-intro">
                No chats yet — create a project above to start your first one.
              </p>
            )}

            {!chatsLoading && chats.length > 0 && (
              <div className="dashboard-chats-list">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    className="history-card"
                    onClick={() => openChat(chat)}
                  >
                    <span>{chat.title}</span>
                    <span className="history-card-date">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="logout-button" onClick={logout}>
            Sign Out
          </button>
        </>
      )}

      <CreateProjectPopup isOpen={popupOpen} onClose={() => setPopupOpen(false)} />

      {user && !checkingOnboarding && showOnboarding && (
        <OnboardingQuiz
          userId={user.uid}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </main>
  );
}