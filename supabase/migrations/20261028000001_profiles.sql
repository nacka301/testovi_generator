-- Faza 2: profiles + RLS.
-- Korisnik smije samo čitati svoj redak i mijenjati svoje ime.
-- plan, trial_tests_left i paid_until mijenja isključivo server (service role) / Stripe webhook.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  ime text,
  created_at timestamptz not null default now(),
  plan text not null default 'trial' check (plan in ('trial', 'paid')),
  trial_tests_left integer not null default 3 check (trial_tests_left >= 0),
  paid_until timestamptz
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Nema insert ni delete politika za klijente: redak nastaje triggerom,
-- a briše se kaskadno brisanjem korisnika u auth.users (brisanje računa radi server).

-- Zaštita od samododjele probe/plana: klijent smije mijenjati samo stupac "ime".
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (ime) on public.profiles to authenticated;

-- Početna proba (trial_tests_left = 3) je default stupca; promjena ide novom migracijom.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, ime)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
