begin;

create unique index mm_voto_categoria_catalogo_idx
  on public.mm_voto_categorias(evento_id) where catalogo;

alter table public.mm_voto_concorrentes
  add column empresa_origem_id uuid,
  drop constraint mm_voto_concorrentes_descricao_check,
  drop constraint mm_voto_concorrentes_cidade_check,
  drop constraint mm_voto_concorrentes_uf_check,
  add check (empresa_origem_id is not null or trim(descricao) <> ''),
  add check (empresa_origem_id is not null or trim(cidade) <> ''),
  add check (uf ~ '^[A-Z]{2}$' or (empresa_origem_id is not null and uf = '')),
  add unique (categoria_id, empresa_origem_id);

create function public.mm_atualizar_catalogo_votacao(p_evento uuid) returns void
language plpgsql set search_path = '' as $$
declare
  categoria uuid;
begin
  perform 1 from public.mm_votacoes
    where evento_id = p_evento and estado <> 'publicada' for update;
  if not found then
    raise exception 'Catálogo indisponível para atualização nesta edição.';
  end if;

  select id into categoria from public.mm_voto_categorias
    where evento_id = p_evento and catalogo;
  if categoria is null then
    insert into public.mm_voto_categorias(evento_id, nome, catalogo)
      values (p_evento, 'Empreendimentos da plataforma', true)
      on conflict (evento_id) where catalogo do nothing
      returning id into categoria;
    if categoria is null then
      select id into categoria from public.mm_voto_categorias where evento_id = p_evento and catalogo;
    end if;
  end if;

  with elegiveis as materialized (
    select e.id, coalesce(nullif(trim(e.nome_fantasia), ''), nullif(trim(e.razao_social), ''), nullif(trim(e.nome), '')) as nome,
      nullif(trim(e.razao_social), '') as razao_social,
      coalesce(nullif(trim(e.nome_responsavel), ''), 'Cadastro da plataforma') as responsavel
    from public.empresas e
    where lower(coalesce(trim(e.tipo_usuario), 'empresa')) <> 'adm'
      and coalesce(e.acesso_tipo, '') not ilike '%EMPRESA OU INICIATIVA INCENTIVADORA%'
  ), sincronizados as (
    insert into public.mm_voto_concorrentes (
      evento_id, categoria_id, empresa_origem_id, nome, razao_social, responsavel, descricao, cidade, uf, publicado
    )
    select p_evento, categoria, id, left(nome, 150), razao_social, responsavel, '', '', '', true
    from elegiveis where nome is not null
    on conflict (categoria_id, empresa_origem_id) do update
      set nome = excluded.nome, razao_social = excluded.razao_social, responsavel = excluded.responsavel, publicado = true
    returning empresa_origem_id
  )
  update public.mm_voto_concorrentes c set publicado = false
  where c.categoria_id = categoria and c.empresa_origem_id is not null and c.publicado
    and not exists (select 1 from sincronizados s where s.empresa_origem_id = c.empresa_origem_id);
end;
$$;

revoke all on function public.mm_atualizar_catalogo_votacao(uuid) from public, anon;
grant execute on function public.mm_atualizar_catalogo_votacao(uuid) to authenticated;
-- O executor usa as políticas administrativas já existentes para edição, catálogo e empresas.

create function public.mm_catalogo_ao_ativar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.mm_atualizar_catalogo_votacao(new.evento_id);
  elsif new.estado = 'ativa' and old.estado is distinct from new.estado then
    perform public.mm_atualizar_catalogo_votacao(new.evento_id);
  end if;
  return new;
end;
$$;

revoke all on function public.mm_catalogo_ao_ativar() from public, anon;
create trigger mm_catalogo_ao_ativar after insert or update of estado on public.mm_votacoes
  for each row execute function public.mm_catalogo_ao_ativar();

select public.mm_atualizar_catalogo_votacao(evento_id) from public.mm_votacoes where estado <> 'publicada';

commit;
