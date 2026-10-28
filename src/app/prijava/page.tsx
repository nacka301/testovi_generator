import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { GoogleButton } from "./google-button";

export const metadata = { title: "Prijava" };

type SearchParams = Promise<{ next?: string; greska?: string }>;

export default function PrijavaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-16">Učitavanje…</p>}>
      <PrijavaForma searchParams={searchParams} />
    </Suspense>
  );
}

async function PrijavaForma({ searchParams }: { searchParams: SearchParams }) {
  const { next, greska } = await searchParams;
  const nextPath = safeNextPath(next);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(nextPath);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Prijava</h1>
      <p className="text-zinc-600">
        Prijavite se Google računom. Pri prvoj prijavi dobivate besplatnu probu
        od 3 testa.
      </p>
      {greska && (
        <p role="alert" className="text-sm text-red-700">
          Prijava nije uspjela. Pokušajte ponovno.
        </p>
      )}
      <GoogleButton next={nextPath} />
    </main>
  );
}
