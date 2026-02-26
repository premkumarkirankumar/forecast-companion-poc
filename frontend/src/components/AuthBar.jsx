import { useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export default function AuthBar() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Google sign-in failed:", e);
      alert(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign-out failed:", e);
      alert(e?.message || "Sign-out failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleSignIn}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-xs font-semibold text-gray-900">
          {user.displayName || "Signed in"}
        </div>
        <div className="text-[11px] text-gray-600">{user.email}</div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={handleSignOut}
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}