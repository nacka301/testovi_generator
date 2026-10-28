# PRD — Generator varijanti provjera iz matematike

Status: **nacrt za potvrdu** (faza 1). Kod se ne piše dok ovaj dokument nije potvrđen.
Datum: 2026-10-28

---

## 1. Cilj i načelo

Profesor matematike (OŠ/SŠ, Hrvatska) uploada PDF/sliku provjere i dobiva PDF s novim grupama (A, B, C, D) i ključem. Mijenjaju se **samo brojevi**; tekst, redoslijed, bodovi, tip i težina ostaju isti.

**Najvažnije svojstvo je točnost.** Jedan krivi ključ pred razredom ubija povjerenje. Zato:

1. Ljudska potvrda prijepisa je obavezna vrata (bez nje nema generiranja).
2. Svaki ključ računa SymPy u Anthropicovu sandboxu, nikad model "napamet".
3. Ključ svake varijante provjerava se **neovisnim drugim pozivom** (vidi 6.4), a ne samo samoprijavom modela.
4. Sve što nije prošlo provjeru vidljivo je crveno i ne ulazi u PDF bez svjesne odluke profesora.

## 2. Što je izvan opsega (v1)

- Stripe / stvarno plaćanje (faza 8, samo na zahtjev). Pripremamo samo `plan` i `paid_until`.
- Zadaci sa **slikama, grafovima, geometrijskim crtežima, tablicama s podacima**. Alat ih ne smije tiho pokvariti: prepoznaje ih i označava "nepodržano" (vidi otvoreno pitanje O3).
- Podaci o učenicima. Ne spremamo ništa osim teksta zadataka.
- Druge predmete i jezike osim matematike na hrvatskom.
- Mobilna aplikacija (web je responzivan, ali optimiziran za desktop).

## 3. Korisnici i tok

Ciljani korisnik: profesor matematike. Sučelje na hrvatskom.

1. **Landing** (javno): jedna rečenica, primjer prije/poslije, "Isprobaj besplatno", FAQ (točnost, privatnost, cijena). Primjer je **stvarna, ručno provjerena izlazna datoteka** (original, varijanta A i ključ kao slike plus PDF za preuzimanje), bez prijave i bez troška AI-ja. Stvarni upload je dostupan tek nakon prijave.
2. **Prijava**: samo Google OAuth (Supabase Auth), obavezna prije bilo kojeg uploada. Nema probe bez prijave ni anonimnih sesija (odluka: zaštita od zlouporabe, jer svaki test košta stvarni novac). Prva prijava = `trial`, 3 testa; jedan Google račun = jedna proba.
3. **Upload**: PDF/JPG/PNG, ≤ 10 MB, ≤ 6 stranica, broj grupa 1–4.
4. **Korak 1 — prijepis**: zadatak po zadatak, KaTeX render, bodovi, rješenje originala (SymPy). Uređivanje LaTeX-a s pregledom uživo. Gumb "Prijepis je točan, generiraj varijante". Upozorenje ako je test skeniran.
5. **Korak 2 — generiranje**: napredak, pregled grupa, tablica provjere (zadatak | original | grupe | svojstva DA/NE), crvena oznaka + "Generiraj ovaj zadatak ponovno".
6. **Korak 3 — PDF**: jedan PDF, zadaci po grupama pa zasebni listovi s ključem.
7. **Povijest**: popis, ponovno preuzimanje, brisanje.
8. **Postavke**: "Obriši račun i sve podatke".

Na svakom pregledu i u PDF-u: *"Rješenja su izračunata i provjerena automatski. Prije korištenja u razredu pregledajte ključ."*

## 4. Arhitektura

```
Preglednik ── Next.js (Vercel, App Router, TS, Tailwind)
                 ├─ Supabase Auth (Google OAuth) + Postgres (RLS) + Storage (privatni bucketi)
                 ├─ Route Handlers ──► Anthropic API (messages + code execution tool, SymPy)
                 └─ Route Handler ───► PDF servis (Docker, FastAPI + pdflatex; Railway/Fly.io)
```

- Ključevi (`ANTHROPIC_API_KEY`, Supabase service key, token PDF servisa) samo na serveru, nikad u klijentu ni logovima.
- Naziv modela i cijene u konfiguraciji (`config/models.ts` ili env), ne u kodu.
- Servisni Supabase ključ samo gdje je nužno (admin stranica, brisanje računa, upis `usage_log`).

### 4.1 Provjereno u službenoj dokumentaciji (2026-10-28)

| Tema | Nalaz | Posljedica |
|---|---|---|
| Code execution tool | GA, bez beta headera. Verzije: `code_execution_20250825`, `_20260120`, `_20260521`. | Koristimo najnoviju verziju koju model podržava; točan `type` potvrđujemo na početku faze 3. |
| SymPy | **Pre-installed** (uz mpmath, numpy, scipy). Kontejner: 1 CPU, 5 GiB RAM, **bez interneta**. | Zahtjev iz poglavlja 2 ispunjen, ne treba alternativa. Ne možemo instalirati dodatne pakete. |
| Cijena code executiona | 1.550 besplatnih sati/mj. po organizaciji, zatim 0,05 USD/h po kontejneru. | Za naš opseg praktički besplatno; dodajemo u `usage_log` samo tokene. |
| ZDR | Code execution **nije** ZDR-eligible. | Ne utječe na nas, ali Politika privatnosti mora to reći. |
| Modeli | Trenutni: `claude-fable-5-1` (10/50 USD po MTok), `claude-opus-5-5` (4/20), `claude-sonnet-5-5` (2/10), `claude-haiku-5-5` (0,10/0,50). Svi podržavaju slike i code execution. | Odabir modela: pitanje O1. |
| PDF ulaz | Stranica se šalje kao slika **plus** izvučeni tekst; ~1.500–3.000 tokena po stranici. Limit 32 MB / 600 str. | Naš limit 10 MB / 6 str. je znatno ispod. Dodatno izvlačenje teksta (`pdfjs-dist`) i dalje ima smisla jer daje doslovne znakove. |
| Opus 5.5 / Sonnet 5.5 / Fable 5.1 | Misaoni način se ne može isključiti; **prisilni `tool_choice` vraća 400**; nema prefilla; `temperature`/`top_p` odbijeni. | JSON izlaz osiguravamo shemom (`output_config.format`, ako je kompatibilna s code executionom, **provjeriti u fazi 3**) ili promptom + zod validacijom s jednim retryjem. |

## 5. Podaci (Supabase)

Tablice prema specifikaciji: `profiles`, `tests`, `usage_log`, sve s RLS-om (`user_id = auth.uid()`).

Dodaci koje predlažem (traže potvrdu):

- `tests.transcription_flags` ili polje unutar JSON-a: je li test skeniran, ima li nepodržanih zadataka.
- `tests.generation_progress` (jsonb): koji su zadaci/grupe gotovi, da ponovno učitavanje stranice ne gubi stanje.
- `profiles.is_deleted`/hard delete: brisanje računa briše retke i objekte u Storageu (vidi O8 za `usage_log`).
- Storage: bucketi `originals` i `pdfs`, putanja `{user_id}/{test_id}/...`, politike po prvom segmentu putanje.
- `usage_log` upisuje isključivo server (service role); korisnik ga ne čita.

Testovi RLS-a: korisnik A ne vidi, ne dohvaća, ne mijenja i ne briše test korisnika B (tablice i Storage), ni preko PostgREST-a ni preko Storage API-ja; anonimni korisnik ne vidi ništa. Izvode se na lokalnom Supabaseu (Docker i `supabase` CLI već postoje na računalu).

## 6. AI cjevovod

### 6.1 Priprema ulaza
Validacija tipa (magic bytes, ne samo ekstenzija), veličine i broja stranica na serveru. Za PDF: izvlačenje teksta po stranicama (`pdfjs-dist`). Modelu idu **PDF/slika + tekstualni sloj**, uz uputu da je tekstualni sloj izvor istine za slova/brojeve/predznake, a slika za strukturu. Nema tekstualnog sloja → upozorenje "Test je skeniran".

### 6.2 Prijepis (korak 5.1)
Jedan poziv s code executionom. Zod shema iz specifikacije. Po zadatku `uncertain`/`note`. Uz svaki (pod)zadatak SymPy rješenje i `properties`.

### 6.3 Generiranje (korak 5.2)
**Predlažem manju granularnost od "sve u jednom pozivu":** jedan poziv po (zadatak × grupa) ili najviše po grupi. Razlozi: (a) petlja do 20 pokušaja po zadatku u jednom pozivu lako prelazi vremensko ograničenje serverless funkcije, (b) "Generiraj ovaj zadatak ponovno" ionako treba pojedinačni poziv, (c) greška jednog zadatka ne ruši cijeli test, (d) lakše se prikazuje napredak. Cijena: više poziva, ali prompt caching ulaza to ublažuje.

Dugotrajni posao: generiranje ne smije ovisiti o jednom HTTP zahtjevu. Predlažem zapis stanja u `tests.generation_progress` i poziv po zadatku iz klijenta ili pozadinski red (točan mehanizam: O5).

### 6.4 Provjera točnosti — moj glavni prijedlog izvan specifikacije
Specifikacija traži da server provjeri `verification` zastavice, ali te zastavice **prijavljuje isti model koji je generirao zadatak**. Server ne smije izvršavati modelov kod, pa ne može sam ponovno izračunati rješenje. To je slaba točka upravo kod najvažnijeg svojstva.

Prijedlog: **neovisni verifikacijski poziv.** Zasebni poziv (po mogućnosti drugi model ili barem druga sesija bez uvida u ključ) dobiva *samo* `text_latex` varijante, rješava ga SymPyjem i vraća rješenje u kanonskom obliku (npr. SymPy `srepr`/`str`, ne LaTeX). Server uspoređuje s ključem po normaliziranom obliku. Nepoklapanje = crveno + ponovno generiranje.

- Plus: hvata greške koje samoprovjera ne hvata (npr. zadatak i ključ konzistentno krivo prepisani).
- Minus: dodatni trošak (~jedan manji poziv po zadatku). Uključujem ga u procjenu troška i mogu ga vezati uz postavku (uvijek uključeno u v1).

### 6.5 Serverska provjera (5.3)
Kako u specifikaciji: identični broj zadataka/podzadataka/bodova; tekst bez brojeva identičan originalu (normaliziran); nijedna grupa nema iste brojeve kao original ili druga grupa; sve `verification` zastavice `true`; **plus** podudaranje s neovisnom provjerom iz 6.4.

Napomena o "tekst bez brojeva": mora rukovati LaTeX-om (`\frac{1}{2}`, `x^{2}`, indeksi, oznake podzadataka). Definiramo što je "broj" (numerički literali u matematici i tekstu, ne indeksi/eksponent-oznake poput `x^{2}` u originalu koji se ne smije mijenjati — vidi O4), jer je to izvor lažnih alarma.

### 6.6 Trošak (5.4)
`usage_log` po pozivu (tokeni, model, cijena iz konfiguracije). Admin stranica za `ADMIN_EMAIL`. Tvrdi mjesečni limit `MONTHLY_COST_LIMIT_EUR`; pri prekoračenju novi testovi se odbijaju. Cijene su u USD, limit u EUR, pa je potreban tečaj u konfiguraciji (O6).

## 7. PDF servis

FastAPI + `pdflatex` iz TeX Livea (paketi iz specifikacije) u Dockeru, Railway ili Fly.io (O7). Zaštita tajnim tokenom, ulaz ≤ 1 MB, `-no-shell-escape`, 30 s timeout, zasebna privremena mapa po poslu koja se briše.

Preambula je fiksna u našem kodu; model daje samo sadržaj. Sanitizacija LaTeX-a po **popisu dopuštenih naredbi** (allowlist), ne popisu zabranjenih. Provjera "običan tekst `^` ili `broj/broj`" izvan matematičkog moda. Test s š, č, ć, ž, đ.

Vercel poziva servis; vraćeni PDF sprema u Storage.

## 8. Besplatna proba i plan

`trial_tests_left = 3` (konfiguracija). Test se troši tek nakon **uspješnog** generiranja. Ponovno generiranje jednog zadatka ne troši test. Atomarno smanjenje brojača u bazi (da dvostruki klik ne potroši dva testa ni ne dopusti negativan broj). Nakon probe: stranica "Proba je završila" i gumb "Javi mi se" (mail za vas, O9). `plan`/`paid_until` pripremljeni za Stripe webhook.

## 9. Sigurnost i privatnost

- Rate limit: 10 uploadova/sat po korisniku (implementacija: O10).
- Validacija datoteke na serveru; potpisani URL-ovi kratkog vijeka za preuzimanje.
- Logovi bez ključeva, tokena i sadržaja datoteka.
- Zaštita od prompt injectiona: sadržaj uploadanog testa je **podatak**; model ne dobiva alate osim code executiona; izlaz se uvijek validira zodom i sanitizira prije LaTeX-a.
- Pravne stranice na hrvatskom (uvjeti, privatnost): email/ime/testovi se spremaju, obrada preko Anthropic API-ja (code execution nije ZDR), postupak brisanja. **Tekstove piše AI i nisu pravni savjet; preporučujem da ih pregleda pravnik.**
- GDPR: ako je lokacija Supabase projekta izvan EU, to se mora navesti (O11).

## 10. Testiranje

- Jedinični: sanitizacija LaTeX-a, zod sheme, serverska provjera 5.3, normalizacija teksta, usporedba rješenja iz 6.4.
- RLS: kako u poglavlju 5.
- E2E: cijeli tok s fiksnim primjerom u `fixtures/` i **mock AI odgovorima** (bez troška).
- PDF servis: test prevođenja s hrvatskim dijakriticima, test odbijanja zabranjenih naredbi, test timeouta.
- Zasebno, **ručno, uz stvarni API**: mali skup stvarnih testova (O12) za mjerenje točnosti prijepisa i ključeva prije pokretanja za korisnike.

## 11. Faze i kriteriji prihvaćanja

| Faza | Sadržaj | Prihvaćeno kad |
|---|---|---|
| 1 | PRD | Potvrđen, otvorena pitanja zatvorena |
| 2 | Kostur: Next.js, Supabase, Google prijava, `profiles`, RLS, Vercel deploy | Prijava radi u anonimnom prozoru na produkcijskoj domeni; RLS testovi prolaze |
| 3 | Upload + prijepis + uređivanje + potvrda | Fiksni primjer test se ispravno prepisuje; ručna potvrda blokira generiranje |
| 4 | Generiranje + 5.3 + neovisna provjera + ponovno generiranje | Tablica provjere ispravno hvata namjerno pokvaren zadatak |
| 5 | PDF servis + sanitizacija + preuzimanje | PDF s dijakriticima i `\frac` nastaje; zabranjene naredbe odbijene |
| 6 | Proba, troškovi, admin | Brojač probe atomaran; limit troška radi |
| 7 | Landing, pravne stranice, brisanje računa | Brisanje računa briše retke i datoteke |
| 8 | Stripe (tek na zahtjev) | — |

Na kraju svake faze: build + testovi, `CHANGELOG.md`, provjera da je **deployano u produkciju** (ne samo lokalno), popis što ručno provjeriti u anonimnom prozoru.

## 12. Procjena troška (okvirna, treba mjerenje u fazi 3–4)

Pretpostavka: test od 6 stranica ≈ 6 × 2.500 ≈ 15.000 ulaznih tokena za prijepis; generiranje 3 grupe × ~8 zadataka s ponavljanjima i izvršavanjem koda; neovisna provjera. Red veličine desetci tisuća do stotine tisuća tokena po testu. Uz `claude-opus-5-5` (4/20 USD po MTok) to je grubo reda veličine 0,5–2 USD po testu, uz `claude-sonnet-5-5` otprilike pola toga. **Ovo je procjena, ne mjerenje**; stvarni broj dobivamo na fiksnim primjerima u fazi 4 i prikazujemo na admin stranici.

---

## 13. Odluke

- **D1 (2026-10-28).** Proba zahtijeva Google prijavu. Landing prikazuje gotov, ručno provjeren primjer umjesto žive probe. Proba bez prijave i anonimne sesije nisu u v1.

## 13a. Otvorena pitanja

**Blokiraju fazu 2–3:**

- **O1. Model(i).** Preporuka: `claude-opus-5-5` za prijepis i generiranje (točnost je prioritet), a neovisna provjera istim modelom u zasebnom pozivu ili jeftinijim `claude-sonnet-5-5`. Slažete li se, ili želite jedan model radi jednostavnosti/cijene? Naziv ide u konfiguraciju pa se kasnije lako mijenja.
- **O2. Domena i imena.** Naziv proizvoda, produkcijska domena, ime Vercel/Supabase/GitHub računa. Google OAuth zahtijeva Google Cloud projekt i zaslon pristanka; trebam li vas voditi korak po korak?
- **O3. Zadaci sa slikama/grafovima/geometrijom.** Predlažem da ih prijepis označi "nepodržano" i da se takav zadatak u varijanti ostavi **nepromijenjen i jasno označen** (ili cijeli test odbije). Što želite?

**Blokiraju fazu 4:**

- **O4. Što točno smatramo "brojem"** pri provjeri "mijenjaju se samo brojevi": uključuju li se eksponenti (`x^{2}`), indeksi, brojevi razreda/zadataka, jedinice (`5\,\text{cm}`)? Predlažem: mijenjaju se samo numerički literali označeni u prijepisu kao parametri; ostalo je strukturalno. Slažete li se da prijepis mora označiti parametre (mali dodatak shemi)?
- **O5. Mehanizam dugotrajnog posla.** Opcije: (a) klijent poziva rutu po zadatku/grupi uz `generation_progress` u bazi (najjednostavnije, radi na Vercelu); (b) pozadinski red (npr. Vercel Queues/Workflow ili Trigger.dev, koji vam je spojen). Preporuka (a) za v1.
- **O6. Tečaj USD→EUR** za `cost_eur`: fiksna vrijednost u konfiguraciji?
- **O12. Stvarni testovi.** Možete li dostaviti 3–5 stvarnih (anonimiziranih) provjera, uključujući jedan skeniran? Bez njih točnost mjerimo samo na sintetičkim primjerima. Jedan od njih ujedno postaje primjer na landingu (nakon što ručno provjerite ključ).

**Blokiraju fazu 5–7:**

- **O7. Railway ili Fly.io** za PDF servis? Preporuka Railway (jednostavniji Docker deploy). Treba račun i kartica na vašoj strani.
- **O8. Brisanje računa i `usage_log`.** Brisati sve, ili zadržati anonimizirane troškovne retke (bez `user_id`) za računovodstvo? Preporuka: anonimizirati, ne brisati.
- **O9. "Javi mi se" mail:** kojim servisom šaljemo (Resend/SendGrid/SMTP) i na koju adresu? Alternativa bez servisa: spremiti zahtjev u tablicu i prikazati na admin stranici. Preporuka: tablica + admin lista za v1.
- **O10. Rate limit:** Postgres brojač po korisniku (bez dodatnih servisa) ili Upstash/Redis? Preporuka: Postgres.
- **O11. Supabase regija:** EU (npr. Frankfurt) radi GDPR-a? Preporuka: da.
- **O13. Cijena i tekst "Proba je završila":** imate li cijenu i tekst, ili ostavljam rezervirano mjesto?
- **O14. Pravni tekstovi:** tko je voditelj obrade (ime/OIB/adresa/kontakt email) koji se navodi u Politici privatnosti?

## 14. Rizici

| Rizik | Ublažavanje |
|---|---|
| Krivo pročitan predznak/eksponent | Obavezna ljudska potvrda; tekstualni sloj + slika; `uncertain` oznake; upozorenje za skenirane testove |
| Model "potvrdi" vlastitu grešku | Neovisni verifikacijski poziv (6.4) |
| Težina varijante odstupa | Mjerljiva pravila težine u promptu + provjera svojstava; profesor vidi tablicu |
| Prekoračenje vremena funkcije | Granularni pozivi + stanje u bazi (6.3) |
| Pad troška izvan kontrole | Mjesečni tvrdi limit, `usage_log`, admin stranica |
| Zlonamjeran sadržaj u uploadu / LaTeX injection | Allowlist naredbi, `-no-shell-escape`, izolirana mapa, timeout, token na servisu |
| Pravna odgovornost za netočan ključ | Napomena na svakom pregledu i u PDF-u; Uvjeti korištenja |
