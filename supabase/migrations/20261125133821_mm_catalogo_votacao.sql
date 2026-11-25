begin;

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
begin
  perform 1 from public.mm_votacoes
    where evento_id = p_evento and estado <> 'publicada' for update;
  if not found then
    raise exception 'Catálogo indisponível para atualização nesta edição.';
  end if;

  with categorias as (
    insert into public.mm_voto_categorias(evento_id, nome, catalogo)
      values
        (p_evento, 'Empresas ou Iniciativas Inclusivas Mais Admiradas', true),
        (p_evento, 'Empreendimentos de Mulheres Negras Mais Admirados', true),
        (p_evento, 'Empreendimentos de Homens Negros Mais Admirados', true)
      on conflict (evento_id, nome) do update set catalogo = true
      returning id, nome
  ), quadro as (
    select empresa_id, case
      when lower(trim(genero)) ~ '^(mulher([[:space:]]|$)|feminino$)' then 'mulher'
      when lower(trim(genero)) ~ '^(homem([[:space:]]|$)|masculino$)' then 'homem'
      when coalesce(lower(trim(genero)), '') in ('', 'não informado', 'nao informado') then
        case lower(trim(sexo)) when 'feminino' then 'mulher' when 'masculino' then 'homem' end
      end as genero
    from public.socios
    where lower(trim(raca)) in ('preto', 'preta', 'pardo', 'parda', 'negro', 'negra')
  ), recortes as (
    select empresa_id, bool_or(genero = 'mulher') as tem_mulher, bool_or(genero = 'homem') as tem_homem
    from quadro group by empresa_id
  ), elegiveis as materialized (
    select e.id, coalesce(nullif(trim(e.nome_fantasia), ''), nullif(trim(e.razao_social), ''), nullif(trim(e.nome), '')) as nome,
      nullif(trim(e.razao_social), '') as razao_social,
      coalesce(nullif(trim(e.nome_responsavel), ''), 'Cadastro da plataforma') as responsavel,
      r.tem_mulher, r.tem_homem,
      'EMPRESA OU INICIATIVA INCENTIVADORA' = any (
        regexp_split_to_array(upper(trim(coalesce(e.acesso_tipo, ''))), '[[:space:]]*,[[:space:]]*')
      ) as incentivadora
    from public.empresas e
    left join recortes r on r.empresa_id = e.id
    where lower(coalesce(trim(e.tipo_usuario), 'empresa')) <> 'adm'
  ), sincronizados as (
    insert into public.mm_voto_concorrentes (
      evento_id, categoria_id, empresa_origem_id, nome, razao_social, responsavel, descricao, cidade, uf, publicado
    )
    select p_evento, c.id, e.id, left(e.nome, 150), e.razao_social, e.responsavel, '', '', '', true
    from elegiveis e cross join categorias c
    where e.nome is not null and case c.nome
      when 'Empresas ou Iniciativas Inclusivas Mais Admiradas' then e.incentivadora
      when 'Empreendimentos de Mulheres Negras Mais Admirados' then not e.incentivadora and e.tem_mulher
      when 'Empreendimentos de Homens Negros Mais Admirados' then not e.incentivadora and e.tem_homem
      end
    on conflict (categoria_id, empresa_origem_id) do update
      set nome = excluded.nome, razao_social = excluded.razao_social, responsavel = excluded.responsavel, publicado = true
    returning categoria_id, empresa_origem_id
  )
  update public.mm_voto_concorrentes c set publicado = false
  where c.categoria_id in (select id from categorias) and c.publicado
    and not exists (select 1 from sincronizados s
      where s.categoria_id = c.categoria_id and s.empresa_origem_id = c.empresa_origem_id);
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
