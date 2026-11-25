begin;

create table public.mm_lotes_voto (
  comprovante text primary key,
  evento_id uuid not null,
  concorrentes uuid[] not null,
  email text not null
);

alter table public.mm_lotes_voto enable row level security;
revoke all on public.mm_lotes_voto from public, anon, authenticated;
grant select, insert on public.mm_lotes_voto to service_role;

create function public.mm_registrar_lote_votos(
  p_evento uuid, p_concorrentes uuid[], p_email text, p_comprovante text
) returns boolean language plpgsql set search_path = '' as $$
declare
  ids uuid[];
  id_concorrente uuid;
  email_normalizado text := lower(trim(p_email));
begin
  if coalesce(cardinality(p_concorrentes), 0) not between 1 and 9
    or p_comprovante is null or p_comprovante !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select array_agg(distinct x order by x) into ids from unnest(p_concorrentes) as x where x is not null;
  if coalesce(cardinality(ids), 0) <> cardinality(p_concorrentes) then return false; end if;
  insert into public.mm_lotes_voto(comprovante, evento_id, concorrentes, email)
    values (p_comprovante, p_evento, ids, email_normalizado)
    on conflict (comprovante) do nothing;

  if not found then
    return exists (
      select 1 from public.mm_lotes_voto
      where comprovante = p_comprovante and evento_id = p_evento
        and concorrentes = ids and email = email_normalizado
    );
  end if;

  -- Mantém a mesma ordem de bloqueio do registro individual e estabiliza a categoria de cada escolha.
  perform 1 from public.mm_eventos where id = p_evento for share;
  perform 1 from public.mm_votacoes where evento_id = p_evento for share;
  perform 1 from public.mm_voto_concorrentes
    where evento_id = p_evento and id = any(ids) order by id for share;
  if exists (
    select 1 from public.mm_voto_concorrentes
    where evento_id = p_evento and id = any(ids)
    group by categoria_id having count(*) > 3
  ) then
    raise exception using errcode = 'MM001', message = 'Limite de três escolhas por categoria.';
  end if;

  foreach id_concorrente in array ids loop
    if not public.mm_registrar_voto(p_evento, id_concorrente, email_normalizado, p_comprovante || ':' || id_concorrente) then
      -- O bloco desfaz também os votos anteriores e o recibo deste lote.
      raise exception using errcode = 'MM001', message = 'Seleção indisponível para votação.';
    end if;
  end loop;
  return true;
exception when sqlstate 'MM001' then
  return false;
end;
$$;

revoke execute on function public.mm_registrar_lote_votos(uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.mm_registrar_lote_votos(uuid, uuid[], text, text) to service_role;

commit;
