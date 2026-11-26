begin;

create table public.mm_votacoes (
  evento_id uuid primary key references public.mm_eventos(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null check (fim > inicio),
  estado text not null default 'rascunho' check (estado in ('rascunho','ativa','suspensa','encerrada','publicada'))
);

create table public.mm_voto_categorias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.mm_votacoes(evento_id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 150),
  ativa boolean not null default true,
  catalogo boolean not null default false,
  unique (evento_id, nome),
  unique (evento_id, id)
);

create table public.mm_voto_concorrentes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  categoria_id uuid not null,
  nome text not null check (length(trim(nome)) between 1 and 150),
  razao_social text,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  responsavel text not null check (trim(responsavel) <> ''),
  descricao text not null check (trim(descricao) <> ''),
  cidade text not null check (trim(cidade) <> ''),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  logo text,
  foto text,
  site text,
  instagram text,
  publicado boolean not null default false,
  nome_indicado_chave text,
  foreign key (evento_id, categoria_id) references public.mm_voto_categorias(evento_id, id) on delete cascade,
  unique (evento_id, categoria_id, id),
  unique (categoria_id, cnpj)
);

create table public.mm_votos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  categoria_id uuid not null,
  concorrente_id uuid not null,
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  comprovante text not null unique,
  criado_em timestamptz not null default clock_timestamp(),
  foreign key (evento_id, categoria_id, concorrente_id) references public.mm_voto_concorrentes(evento_id, categoria_id, id)
);

create index mm_votos_apuracao_idx on public.mm_votos(evento_id, categoria_id, concorrente_id);
create index mm_votos_auditoria_idx on public.mm_votos(evento_id, criado_em desc, id desc);

alter table public.mm_votacoes enable row level security;
alter table public.mm_voto_categorias enable row level security;
alter table public.mm_voto_concorrentes enable row level security;
alter table public.mm_votos enable row level security;

revoke all on public.mm_votacoes, public.mm_voto_categorias, public.mm_voto_concorrentes, public.mm_votos from public, anon, authenticated;
grant select, insert, update on public.mm_votacoes, public.mm_voto_categorias, public.mm_voto_concorrentes to authenticated;
grant select (id, evento_id, categoria_id, concorrente_id, email, criado_em) on public.mm_votos to authenticated;
grant select on public.mm_votacoes, public.mm_voto_categorias, public.mm_voto_concorrentes, public.mm_eventos to service_role;
grant select, insert on public.mm_votos to service_role;
-- PostgreSQL exige privilégio UPDATE para bloquear linhas com FOR SHARE.
grant update on public.mm_eventos, public.mm_votacoes, public.mm_voto_categorias, public.mm_voto_concorrentes to service_role;

create policy mm_votacoes_adm on public.mm_votacoes for all to authenticated
  using ((select public.is_system_admin())) with check ((select public.is_system_admin()));
create policy mm_voto_categorias_adm on public.mm_voto_categorias for all to authenticated
  using ((select public.is_system_admin())) with check ((select public.is_system_admin()));
create policy mm_voto_concorrentes_adm on public.mm_voto_concorrentes for all to authenticated
  using ((select public.is_system_admin())) with check ((select public.is_system_admin()));
create policy mm_votos_adm on public.mm_votos for select to authenticated
  using ((select public.is_system_admin()));

create function public.mm_voto_proteger_edicao() returns trigger
language plpgsql set search_path = '' as $$
declare
  situacao text;
begin
  if tg_table_name = 'mm_votacoes' then
    if old.evento_id <> new.evento_id or old.estado = 'publicada'
      or (new.estado = 'publicada' and old.estado <> 'encerrada') then
      raise exception 'Alteração indisponível para esta votação.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.evento_id <> new.evento_id then raise exception 'A edição do registro é fixa.'; end if;
  end if;
  select estado into situacao from public.mm_votacoes where evento_id = new.evento_id for share;
  if situacao = 'publicada' then raise exception 'Resultado definitivo já publicado.'; end if;
  return new;
end;
$$;

create trigger mm_votacoes_proteger before update on public.mm_votacoes
  for each row execute function public.mm_voto_proteger_edicao();
create trigger mm_voto_categorias_proteger before insert or update on public.mm_voto_categorias
  for each row execute function public.mm_voto_proteger_edicao();
create trigger mm_voto_concorrentes_proteger before insert or update on public.mm_voto_concorrentes
  for each row execute function public.mm_voto_proteger_edicao();

create function public.mm_registrar_voto(
  p_evento uuid, p_concorrente uuid, p_email text, p_comprovante text
) returns boolean language plpgsql set search_path = '' as $$
declare
  votacao public.mm_votacoes%rowtype;
  concorrente public.mm_voto_concorrentes%rowtype;
begin
  if exists (select 1 from public.mm_votos where comprovante = p_comprovante
    and evento_id = p_evento and concorrente_id = p_concorrente and email = lower(trim(p_email))) then
    return true;
  end if;
  perform 1 from public.mm_eventos where id = p_evento and ativo for share;
  if not found then return false; end if;
  select * into votacao from public.mm_votacoes where evento_id = p_evento for share;
  if not found or votacao.estado <> 'ativa' then return false; end if;
  select n.* into concorrente from public.mm_voto_concorrentes n
    join public.mm_voto_categorias c on c.id = n.categoria_id
    where n.evento_id = p_evento and n.id = p_concorrente and n.publicado and c.ativa
      and (c.catalogo or not exists (
        select 1 from public.mm_voto_categorias geral where geral.evento_id = p_evento and geral.catalogo
      ))
    for share of n, c;
  if not found or clock_timestamp() < votacao.inicio or clock_timestamp() >= votacao.fim then
    return false;
  end if;
  insert into public.mm_votos(evento_id, categoria_id, concorrente_id, email, comprovante)
    values (p_evento, concorrente.categoria_id, p_concorrente, lower(trim(p_email)), p_comprovante)
    on conflict (comprovante) do nothing;
  return exists (select 1 from public.mm_votos where comprovante = p_comprovante
    and evento_id = p_evento and concorrente_id = p_concorrente and email = lower(trim(p_email)));
end;
$$;

revoke execute on function public.mm_registrar_voto(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.mm_registrar_voto(uuid, uuid, text, text) to service_role;

create view public.mm_voto_ranking with (security_invoker = true) as
with contagem as (
  select n.evento_id, n.categoria_id, n.id, n.nome, n.descricao, n.cidade, n.uf,
    n.logo, n.foto, n.site, n.instagram, count(v.id)::integer as votos
  from public.mm_voto_concorrentes n
  join public.mm_voto_categorias c on c.id = n.categoria_id and c.ativa
  left join public.mm_votos v on v.concorrente_id = n.id and v.evento_id = n.evento_id
    and v.categoria_id = n.categoria_id
  where n.publicado
  group by n.id
)
select contagem.*, rank() over (partition by contagem.categoria_id order by votos desc)::integer as posicao,
  coalesce(round(100.0 * votos / nullif(sum(votos) over (partition by contagem.categoria_id), 0), 2), 0) as percentual,
  n.razao_social
from contagem join public.mm_voto_concorrentes n on n.id = contagem.id;

create view public.mm_voto_totais with (security_invoker = true) as
select evento_id, categoria_id, count(*)::integer as votos, count(distinct email)::integer as emails
from public.mm_votos group by grouping sets ((evento_id), (evento_id, categoria_id));

revoke all on public.mm_voto_ranking, public.mm_voto_totais from public, anon, authenticated;
grant select on public.mm_voto_ranking to authenticated, service_role;
grant select on public.mm_voto_totais to authenticated;

-- 23h59 de 04/12 inclui o minuto inteiro, até a meia-noite de Brasília.
insert into public.mm_votacoes(evento_id, inicio, fim)
select id, least(now(), '2026-12-04 23:59:00-03'::timestamptz), '2026-12-05 00:00:00-03'::timestamptz
from public.mm_eventos where ano = 2026;

insert into public.mm_voto_categorias(evento_id, nome)
select v.evento_id, c.nome from public.mm_votacoes v cross join (values
  ('Empresas ou Iniciativas Inclusivas Mais Admiradas'),
  ('Empreendimentos de Mulheres Negras Mais Admirados'),
  ('Empreendimentos de Homens Negros Mais Admirados')
) as c(nome);

commit;
