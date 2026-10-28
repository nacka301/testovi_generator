"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError("Prijava nije uspjela. Pokušajte ponovno.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="rounded-md border border-zinc-300 bg-white px-5 py-3 font-medium hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? "Preusmjeravanje…" : "Nastavi s Googleom"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
