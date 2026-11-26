begin;
create unique index mm_voto_indicacao_nome_idx
  on public.mm_voto_concorrentes(categoria_id, nome_indicado_chave) where nome_indicado_chave is not null;

grant select (nome_fantasia, razao_social) on public.empresas to service_role;

create function public.mm_chave_indicacao(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(regexp_replace(normalize(coalesce(p_nome, ''), NFD), '[̀-ͯ]', '', 'g')), '[^[:alnum:]]', '', 'g')
$$;

create function public.mm_registrar_votos_com_indicacoes(
  p_evento uuid, p_concorrentes uuid[], p_indicacoes jsonb, p_email text, p_comprovante text
) returns uuid[] language plpgsql set search_path = '' as $$
declare
  ids uuid[] := coalesce(p_concorrentes, '{}'::uuid[]);
  item jsonb;
  categoria uuid;
  nome_empresa text;
  chave text;
  candidato uuid;
  disponivel boolean;
begin
  if jsonb_typeof(p_indicacoes) is distinct from 'array' then return null; end if;
  if cardinality(ids) + jsonb_array_length(p_indicacoes) not between 1 and 9 then return null; end if;
  if jsonb_array_length(p_indicacoes) > 0 then
    perform 1 from public.mm_eventos where id = p_evento and ativo for share;
    if not found then return null; end if;
    perform 1 from public.mm_votacoes where evento_id = p_evento and estado = 'ativa'
      and clock_timestamp() >= inicio and clock_timestamp() < fim for update;
    if not found then return null; end if;
  end if;

  for item in select value from jsonb_array_elements(p_indicacoes) loop
    categoria := (item->>'categoria_id')::uuid;
    nome_empresa := regexp_replace(trim(item->>'nome'), '[[:space:]]+', ' ', 'g');
    chave := public.mm_chave_indicacao(nome_empresa);
    if nome_empresa is null or length(nome_empresa) not between 2 and 150 or length(chave) < 2
      or not exists (select 1 from public.mm_voto_categorias where id = categoria and evento_id = p_evento and ativa and catalogo
        and nome = 'Empresas ou Iniciativas Inclusivas Mais Admiradas')
    then raise exception using errcode = 'MM001', message = 'Indicação inválida.'; end if;

    select n.id, n.publicado into candidato, disponivel from public.mm_voto_concorrentes n
      where n.categoria_id = categoria and (public.mm_chave_indicacao(n.nome) = chave
        or public.mm_chave_indicacao(n.razao_social) = chave)
      order by n.publicado desc, n.id limit 1;
    if candidato is not null and not disponivel then
      raise exception using errcode = 'MM001', message = 'Empresa indisponível nesta categoria.';
    end if;
    if candidato is null then
      if exists (select 1 from public.empresas e
        where public.mm_chave_indicacao(e.nome_fantasia) = chave or public.mm_chave_indicacao(e.razao_social) = chave)
      then raise exception using errcode = 'MM001', message = 'Empresa cadastrada em outro perfil.'; end if;
      insert into public.mm_voto_concorrentes (evento_id,categoria_id,nome,responsavel,descricao,cidade,uf,publicado,nome_indicado_chave)
        values (p_evento,categoria,nome_empresa,'Indicação do público','','','',true,chave)
        returning id into candidato;
    end if;
    ids := array_append(ids, candidato);
  end loop;

  if not public.mm_registrar_lote_votos(p_evento, ids, p_email, p_comprovante) then
    raise exception using errcode = 'MM001', message = 'Seleção indisponível para votação.';
  end if;
  return ids;
exception when sqlstate 'MM001' or invalid_text_representation then
  return null;
end;
$$;

revoke execute on function public.mm_registrar_votos_com_indicacoes(uuid,uuid[],jsonb,text,text) from public, anon, authenticated;
grant execute on function public.mm_registrar_votos_com_indicacoes(uuid,uuid[],jsonb,text,text) to service_role;
grant insert on public.mm_voto_concorrentes to service_role;
commit;
