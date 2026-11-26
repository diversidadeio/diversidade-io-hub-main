create function public.mm_catalogo_ao_alterar_socios() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  edicao uuid;
begin
  for edicao in
    select v.evento_id
    from public.mm_votacoes v
    join public.mm_eventos e on e.id = v.evento_id
    where e.ativo and v.estado = 'ativa' and now() < v.fim
    order by v.evento_id
    for update of v
  loop
    perform public.mm_atualizar_catalogo_votacao(edicao);
  end loop;
  return null;
end;
$$;

revoke all on function public.mm_catalogo_ao_alterar_socios() from public, anon, authenticated;

create trigger mm_catalogo_ao_alterar_socios
  after insert or update of empresa_id, genero, sexo, raca or delete on public.socios
  for each statement execute function public.mm_catalogo_ao_alterar_socios();
