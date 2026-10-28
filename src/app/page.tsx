import Link from "next/link";

// Privremena landing stranica; puna verzija dolazi u fazi 7.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">
        Nove grupe vaše provjere iz matematike, s drugim brojevima
      </h1>
      <p className="text-lg text-zinc-600">
        Učitajte postojeću provjeru. Formulacije, bodovi i težina ostaju isti,
        mijenjaju se samo brojevi, a ključ je izračunat i provjeren.
      </p>
      <div>
        <Link
          href="/prijava"
          className="inline-block rounded-md bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700"
        >
          Isprobaj besplatno
        </Link>
      </div>
    </main>
  );
}
