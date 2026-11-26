create or replace function public.mm_buscar_concorrentes_por_socio(p_evento uuid, p_categoria uuid, p_nome text)
returns uuid[] language sql stable set search_path = '' as $$
  with consulta as (
    select public.mm_chave_indicacao(left(p_nome, 150)) as chave,
      regexp_split_to_array(trim(left(p_nome, 150)), '[[:space:]]+') as palavras
  ), termos as (
    select distinct public.mm_chave_indicacao(palavra) as chave
    from consulta cross join unnest(consulta.palavras) as partes(palavra)
    where public.mm_chave_indicacao(palavra) <> ''
  )
  select coalesce(array_agg(n.id), '{}'::uuid[])
  from public.mm_voto_concorrentes n
  join public.mm_voto_categorias c on c.id = n.categoria_id and c.ativa and c.catalogo
  join public.mm_eventos e on e.id = n.evento_id and e.ativo
  join public.mm_votacoes v on v.evento_id = e.id and v.estado <> 'rascunho'
  cross join consulta
  where n.evento_id = p_evento and n.categoria_id = p_categoria and n.publicado
    and length(consulta.chave) >= 3
    and exists (
      select 1 from public.socios s
      where s.empresa_id = n.empresa_origem_id
        and not exists (
          select 1 from termos t
          where strpos(public.mm_chave_indicacao(s.nome), t.chave) = 0
        )
    );
$$;
