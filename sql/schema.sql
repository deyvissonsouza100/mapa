create extension if not exists pgcrypto;

create table if not exists public.viaturas (
  id uuid primary key default gen_random_uuid(),
  prefix text not null,
  team text,
  latitude double precision not null,
  longitude double precision not null,
  address_label text,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.viaturas
  add column if not exists prefix text,
  add column if not exists team text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists address_label text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.viaturas
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

create table if not exists public.locais_operacionais_bh (
  id uuid primary key default gen_random_uuid(),
  nome_local text not null,
  endereco text,
  bairro text,
  regional text,
  latitude double precision not null,
  longitude double precision not null,
  aliases text,
  created_at timestamptz not null default now()
);

alter table public.locais_operacionais_bh
  add column if not exists nome_local text,
  add column if not exists endereco text,
  add column if not exists bairro text,
  add column if not exists regional text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists aliases text,
  add column if not exists created_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_viaturas_updated_at on public.viaturas;

create trigger trg_viaturas_updated_at
before update on public.viaturas
for each row
execute function public.set_updated_at();

alter table public.viaturas enable row level security;
alter table public.locais_operacionais_bh enable row level security;

drop policy if exists "viaturas_select_public" on public.viaturas;
drop policy if exists "viaturas_insert_public" on public.viaturas;
drop policy if exists "viaturas_update_public" on public.viaturas;
drop policy if exists "viaturas_delete_public" on public.viaturas;

create policy "viaturas_select_public"
on public.viaturas
for select
to anon
using (true);

create policy "viaturas_insert_public"
on public.viaturas
for insert
to anon
with check (true);

create policy "viaturas_update_public"
on public.viaturas
for update
to anon
using (true)
with check (true);

create policy "viaturas_delete_public"
on public.viaturas
for delete
to anon
using (true);

drop policy if exists "locais_select_public" on public.locais_operacionais_bh;
drop policy if exists "locais_insert_public" on public.locais_operacionais_bh;
drop policy if exists "locais_update_public" on public.locais_operacionais_bh;
drop policy if exists "locais_delete_public" on public.locais_operacionais_bh;

create policy "locais_select_public"
on public.locais_operacionais_bh
for select
to anon
using (true);

create policy "locais_insert_public"
on public.locais_operacionais_bh
for insert
to anon
with check (true);

create policy "locais_update_public"
on public.locais_operacionais_bh
for update
to anon
using (true)
with check (true);

create policy "locais_delete_public"
on public.locais_operacionais_bh
for delete
to anon
using (true);

insert into public.locais_operacionais_bh
(nome_local, endereco, bairro, regional, latitude, longitude, aliases)
values
('Casa do Baile', 'Avenida Otacílio Negrão de Lima, Pampulha, Belo Horizonte', 'Pampulha', 'Pampulha', -19.8519, -43.9720, 'Praça Dalva Simão;Casa do Baile/Praça Dalva Simão'),
('Praça Dino Barbieri', 'Praça Dino Barbieri, Belo Horizonte', 'Pampulha', 'Pampulha', -19.8568, -43.9708, 'Dino Barbieri'),
('Museu de Arte da Pampulha', 'Avenida Otacílio Negrão de Lima, 16585, Belo Horizonte', 'Pampulha', 'Pampulha', -19.8586, -43.9745, 'MAP;Museu de Arte da Pampulha'),
('Zoológico', 'Avenida Otacílio Negrão de Lima, 8000, Belo Horizonte', 'Pampulha', 'Pampulha', -19.8657, -44.0026, 'Portaria Principal;Portaria Secundária;Zoológico'),
('Marco Zero', 'Orla da Lagoa da Pampulha, Belo Horizonte', 'Pampulha', 'Pampulha', -19.8486, -43.9676, 'Parque Ecológico Promotor José Lins do Rêgo;Marco Zero/Parque Ecológico');
