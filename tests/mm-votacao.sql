-- Executar após a migração, em uma base de teste.
begin;
set local role postgres;

insert into public.mm_eventos(id, ano, titulo, inicio_cadastro, fim_cadastro, ativo)
values ('f0000000-0000-0000-0000-000000000001', 2099, 'Teste', '2099-11-01', '2099-12-01', false);
update public.mm_eventos set ativo = false where ativo;
update public.mm_eventos set ativo = true where ano = 2099;

insert into public.mm_votacoes values
  ('f0000000-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour', 'ativa');
insert into public.mm_voto_categorias(id, evento_id, nome) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Teste');
insert into public.mm_voto_concorrentes(id, evento_id, categoria_id, nome, responsavel, descricao, cidade, uf, publicado)
select id::uuid, 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
  nome, 'Responsável', 'Descrição', 'São Paulo', 'SP', publicado
from (values
  ('f0000000-0000-0000-0000-000000000003', 'A', true),
  ('f0000000-0000-0000-0000-000000000004', 'B', true),
  ('f0000000-0000-0000-0000-000000000005', 'Rascunho', false)
) as x(id, nome, publicado);

set local role service_role;
do $$
declare
  evento constant uuid := 'f0000000-0000-0000-0000-000000000001';
  a constant uuid := 'f0000000-0000-0000-0000-000000000003';
  b constant uuid := 'f0000000-0000-0000-0000-000000000004';
  rascunho constant uuid := 'f0000000-0000-0000-0000-000000000005';
begin
  if not public.mm_registrar_voto(evento, a, 'Pessoa@example.org', 'teste-1')
    or not public.mm_registrar_voto(evento, a, 'pessoa@example.org', 'teste-2')
    or not public.mm_registrar_voto(evento, a, 'pessoa@example.org', 'teste-2')
    or not public.mm_registrar_voto(evento, b, 'pessoa@example.org', 'teste-3')
    or not public.mm_registrar_voto(evento, b, 'outra@example.org', 'teste-4')
    or public.mm_registrar_voto(evento, b, 'pessoa@example.org', 'teste-1')
    or public.mm_registrar_voto(evento, rascunho, 'pessoa@example.org', 'teste-5') then
    raise exception 'Falha no registro de votos ou na deduplicação do desafio.';
  end if;
  if 2 <> (select count(*) from public.mm_voto_ranking where evento_id = evento
    and posicao = 1 and votos = 2 and percentual = 50) then
    raise exception 'Falha de contagem, percentual ou empate.';
  end if;
end $$;

set local role postgres;
update public.mm_votacoes set inicio = now() - interval '2 hours', fim = now() - interval '1 hour'
where evento_id = 'f0000000-0000-0000-0000-000000000001';

set local role service_role;
do $$
begin
  if public.mm_registrar_voto('f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000003', 'pessoa@example.org', 'teste-expirado') then
    raise exception 'Aceitou voto após o encerramento.';
  end if;
end $$;

set local role anon;
do $$
begin
  if has_column_privilege(current_user, 'public.mm_votos', 'email', 'select')
    or has_function_privilege(current_user, 'public.mm_registrar_voto(uuid,uuid,text,text)', 'execute') then
    raise exception 'Votos expostos ao papel público.';
  end if;
end $$;

set local role authenticated;
do $$
begin
  if exists (select 1 from public.mm_votos where evento_id = 'f0000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.mm_voto_ranking where evento_id = 'f0000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.mm_voto_totais where evento_id = 'f0000000-0000-0000-0000-000000000001') then
    raise exception 'A sessão sem permissão administrativa conseguiu consultar a votação.';
  end if;
  if has_function_privilege(current_user, 'public.mm_registrar_voto(uuid,uuid,text,text)', 'execute') then
    raise exception 'A sessão autenticada consegue pular a verificação do servidor.';
  end if;
end $$;

set local role postgres;
update public.mm_votacoes set estado = 'encerrada' where evento_id = 'f0000000-0000-0000-0000-000000000001';
update public.mm_votacoes set estado = 'publicada' where evento_id = 'f0000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    update public.mm_voto_concorrentes set publicado = false where id = 'f0000000-0000-0000-0000-000000000003';
    raise exception 'Resultado definitivo aceitou alteração.' using errcode = 'XX000';
  exception when raise_exception then
    null;
  end;
end $$;

rollback;
