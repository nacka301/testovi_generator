// RLS testovi protiv LOKALNOG Supabasea (npm run db:start, zatim npm run test:rls).
// Lokalno je uključena e-mail prijava samo zato da test može napraviti korisnike.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL!;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const run = Date.now();

type TestUser = { id: string; email: string; client: SupabaseClient };

async function makeUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${run}@example.test`;
  const password = `Lozinka-${run}-${label}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Korisnik ${label}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  a = await makeUser("a");
  b = await makeUser("b");
});

afterAll(async () => {
  for (const u of [a, b]) if (u) await admin.auth.admin.deleteUser(u.id);
});

describe("profiles: nastanak", () => {
  it("trigger stvara profil s probom od 3 testa", async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", a.id)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      email: a.email,
      ime: "Korisnik a",
      plan: "trial",
      trial_tests_left: 3,
      paid_until: null,
    });
  });
});

describe("profiles: čitanje", () => {
  it("korisnik A vidi samo svoj profil", async () => {
    const { data, error } = await a.client.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: a.id }]);
  });

  it("korisnik A ne može dohvatiti profil korisnika B po id-u", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .select("*")
      .eq("id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anonimni klijent ne vidi ništa i nema pristup tablici", async () => {
    const anon = createClient(url, publishableKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.from("profiles").select("id");
    // Bez GRANT-a PostgREST vraća grešku "permission denied", nikad podatke.
    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("profiles: pisanje", () => {
  it("korisnik smije promijeniti svoje ime", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ ime: "Novo ime" })
      .eq("id", a.id);
    expect(error).toBeNull();
    const { data } = await admin
      .from("profiles")
      .select("ime")
      .eq("id", a.id)
      .single();
    expect(data?.ime).toBe("Novo ime");
  });

  it("korisnik ne može sam sebi povećati probu", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ trial_tests_left: 999 })
      .eq("id", a.id);
    expect(error).not.toBeNull();
    const { data } = await admin
      .from("profiles")
      .select("trial_tests_left")
      .eq("id", a.id)
      .single();
    expect(data?.trial_tests_left).toBe(3);
  });

  it("korisnik ne može sam sebi dodijeliti plaćeni plan ni paid_until", async () => {
    for (const patch of [
      { plan: "paid" },
      { paid_until: "2099-01-01T00:00:00Z" },
    ]) {
      const { error } = await a.client
        .from("profiles")
        .update(patch)
        .eq("id", a.id);
      expect(error).not.toBeNull();
    }
    const { data } = await admin
      .from("profiles")
      .select("plan, paid_until")
      .eq("id", a.id)
      .single();
    expect(data).toEqual({ plan: "trial", paid_until: null });
  });

  it("korisnik A ne može mijenjati profil korisnika B", async () => {
    const { data } = await a.client
      .from("profiles")
      .update({ ime: "Hakirano" })
      .eq("id", b.id)
      .select();
    expect(data ?? []).toEqual([]);
    const { data: row } = await admin
      .from("profiles")
      .select("ime")
      .eq("id", b.id)
      .single();
    expect(row?.ime).toBe("Korisnik b");
  });

  it("korisnik ne može obrisati profil (svoj ni tuđi)", async () => {
    for (const u of [a, b]) {
      await a.client.from("profiles").delete().eq("id", u.id);
    }
    const { data } = await admin
      .from("profiles")
      .select("id")
      .in("id", [a.id, b.id]);
    expect(data).toHaveLength(2);
  });

  it("korisnik ne može umetnuti profil", async () => {
    const { error } = await a.client
      .from("profiles")
      .insert({ id: a.id, email: "x@example.test" });
    expect(error).not.toBeNull();
  });
});
