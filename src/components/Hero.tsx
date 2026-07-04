"use client";

import Image from "next/image";
import landing from "../assets/landing.png";

import { auth } from "../app/firebase/config";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();

      await signInWithPopup(auth, provider);

      console.log("Login successful!");

      router.push("/dashboard");
    } catch (err) {
      console.error("Google Login Error:", err);
    }
  };

  return (
    <main className="landing-page">
      <Image
        src={landing}
        alt="NEXUS AI Landing Page"
        fill
        priority
        quality={100}
        sizes="100vw"
        className="landing-image"
      />

      <button
        onClick={signInWithGoogle}
        className="google-login"
        aria-label="Continue with Google"
      >
        <Image
          src="/google-login-button.png"
          alt="Continue with Google"
          width={320}
          height={70}
          className="google-button-image"
        />
      </button>
    </main>
  );
}