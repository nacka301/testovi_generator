import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Moji testovi" };

export default function AppHome() {
  return (
    <Suspense fallback={<p className="px-4 py-16">Učitavanje…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/prijava");

  // RLS vraća samo redak prijavljenog korisnika.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, ime, plan, trial_tests_left")
    .single();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Dobrodošli{profile?.ime ? `, ${profile.ime}` : ""}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-zinc-700">
        <dt className="font-medium">E-pošta</dt>
        <dd>{profile?.email}</dd>
        <dt className="font-medium">Plan</dt>
        <dd>{profile?.plan === "paid" ? "Plaćeni" : "Proba"}</dd>
        {profile?.plan !== "paid" && (
          <>
            <dt className="font-medium">Preostalo testova</dt>
            <dd>{profile?.trial_tests_left}</dd>
          </>
        )}
      </dl>
      <p className="text-zinc-600">Učitavanje testova dolazi u sljedećoj fazi.</p>
      <form action="/auth/odjava" method="post">
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
        >
          Odjava
        </button>
      </form>
    </main>
  );
}
