import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD-RjWwiZBs7oG3WL3aPlOaWsYyN2C3uBw",
  authDomain: "nexus-ai-8cc2c.firebaseapp.com",
  projectId: "nexus-ai-8cc2c",
  storageBucket: "nexus-ai-8cc2c.appspot.com",
  messagingSenderId: "39082883451",
  appId: "1:39082883451:web:eaa82bf9ace9363aaa65de",
  measurementId: "G-SM94K8W6TJ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);