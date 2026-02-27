// frontend/src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6c83GuNp2lWMzmFzdLPRwW8m5mfotr6w",
  authDomain: "forecast-poc-488523.firebaseapp.com",
  projectId: "forecast-poc-488523",
  storageBucket: "forecast-poc-488523.firebasestorage.app",
  messagingSenderId: "485773887918",
  appId: "1:485773887918:web:ab626dec6caafa7c7ea03f",
  measurementId: "G-M0HRE9TBVQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🔥 Firestore database
export const db = getFirestore(app);

// 🔐 Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();