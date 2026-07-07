"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import dashboard from "../../assets/dashboard.png";

import { auth } from "../firebase/config";
import {
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log(currentUser);

      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

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
{/* Search Bar */}

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

      <button
        onClick={logout}
        className="logout-button"
      >
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
{/* Per Growth Button */}

<button
  className="per-growth-button"
  onClick={() => {
    alert("Project list coming next!");
  }}
>
  <Image
    src="/per-grow.png"
    alt="Per Growth"
    width={240}
    height={70}
    priority
    className="per-growth-image"
  />
</button>