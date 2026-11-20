-- Migration 40: Maiores & Melhores — dados da empresa na página de confirmação do comprador
-- Diversidade.io — 2026
--
-- O que muda:
--  mm_confirmacao_obter passa a devolver, além dos dados da nota, os dados da empresa inscrita
--  que pede a confirmação (razão social, CNPJ, cidade, responsável, e-mail e telefone de contato),
--  o papel dela na nota e a validade do link. São os mesmos dados que já vão no e-mail enviado ao
--  comprador; a página mostra tudo para ele decidir se aprova ou não.
--
-- Só quem tem o link individual (token de 64 caracteres, enviado ao e-mail do comprador) consegue
-- ler esses dados, e só enquanto o link estiver valendo e sem resposta.
--
-- Nenhuma tabela muda. As permissões da função continuam as mesmas (CREATE OR REPLACE as mantém).
-- Execute no SQL Editor do Supabase, depois da migration 39.

CREATE OR REPLACE FUNCTION public.mm_confirmacao_obter(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v RECORD;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  SELECT e.razao_social, e.cnpj, e.municipio, e.uf, e.responsavel, e.email, p.telefone,
         n.cnpj_comprador, n.cnpj_vendedor, n.razao_social_parceiro,
         n.numero_nota, n.serie_nota, n.data_emissao, n.valor_centavos, n.token_expira_em
    INTO v
  FROM public.mm_negocios n
  JOIN public.mm_empresas e ON e.id = n.empresa_id
  JOIN public.mm_participantes p ON p.id = e.participante_id
  WHERE n.token_hash = public.mm_hash(p_token)
    AND n.token_expira_em > now()
    AND n.resposta_comprador IS NULL
    AND n.status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  RETURN jsonb_build_object(
    'compradora',      CASE WHEN v.cnpj = v.cnpj_comprador THEN v.razao_social ELSE v.razao_social_parceiro END,
    'vendedora',       CASE WHEN v.cnpj = v.cnpj_comprador THEN v.razao_social_parceiro ELSE v.razao_social END,
    'cnpj_comprador',  v.cnpj_comprador,
    'cnpj_vendedor',   v.cnpj_vendedor,
    'numero_nota',     v.numero_nota,
    'serie_nota',      v.serie_nota,
    'data_emissao',    v.data_emissao,
    'valor_centavos',  v.valor_centavos,
    'papel_inscrita',  CASE WHEN v.cnpj = v.cnpj_comprador THEN 'comprador' ELSE 'vendedor' END,
    'expira_em',       v.token_expira_em,
    'empresa',         jsonb_build_object(
                         'razao_social', v.razao_social,
                         'cnpj',         v.cnpj,
                         'municipio',    v.municipio,
                         'uf',           v.uf,
                         'responsavel',  v.responsavel,
                         'email',        v.email,
                         'telefone',     v.telefone
                       )
  );
END;
$$;
