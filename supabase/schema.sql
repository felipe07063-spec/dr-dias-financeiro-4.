-- DR DIAS FINANCEIRO IA
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Carteira familiar',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_members (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (wallet_id, user_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in ('income','expense')),
  category text not null default 'Outros',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;
alter table public.wallet_members enable row level security;
alter table public.transactions enable row level security;

create or replace function public.is_wallet_member(target_wallet uuid)
returns boolean language sql security definer stable set search_path = public
as $$ select exists(select 1 from public.wallet_members where wallet_id = target_wallet and user_id = auth.uid()); $$;

create policy "members can view their wallets" on public.wallets
for select using (exists(select 1 from public.wallet_members m where m.wallet_id = id and m.user_id = auth.uid()));

create policy "members can view membership" on public.wallet_members
for select using (user_id = auth.uid() or public.is_wallet_member(wallet_id));

create policy "members can view transactions" on public.transactions
for select using (public.is_wallet_member(wallet_id));

create policy "members can add transactions" on public.transactions
for insert with check (public.is_wallet_member(wallet_id) and created_by = auth.uid());

create policy "members can edit transactions" on public.transactions
for update using (public.is_wallet_member(wallet_id)) with check (public.is_wallet_member(wallet_id));

create policy "members can delete transactions" on public.transactions
for delete using (public.is_wallet_member(wallet_id));

create or replace function public.create_family_wallet()
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_wallet uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists(select 1 from public.wallet_members where user_id = auth.uid()) then
    raise exception 'Este usuário já participa de uma carteira.';
  end if;
  insert into public.wallets(name) values ('Carteira familiar') returning id into new_wallet;
  insert into public.wallet_members(wallet_id,user_id,role) values (new_wallet,auth.uid(),'owner');
  return new_wallet;
end;
$$;

create or replace function public.join_family_wallet(invite_code_input text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_wallet uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  select id into target_wallet from public.wallets where invite_code = upper(trim(invite_code_input));
  if target_wallet is null then raise exception 'Código de convite inválido.'; end if;
  if (select count(*) from public.wallet_members where wallet_id = target_wallet) >= 2 then
    raise exception 'Esta carteira já atingiu o limite de dois usuários.';
  end if;
  if exists(select 1 from public.wallet_members where user_id = auth.uid()) then
    raise exception 'Este usuário já participa de uma carteira.';
  end if;
  insert into public.wallet_members(wallet_id,user_id,role) values (target_wallet,auth.uid(),'member');
  return target_wallet;
end;
$$;

grant execute on function public.create_family_wallet() to authenticated;
grant execute on function public.join_family_wallet(text) to authenticated;
grant execute on function public.is_wallet_member(uuid) to authenticated;

alter publication supabase_realtime add table public.transactions;
