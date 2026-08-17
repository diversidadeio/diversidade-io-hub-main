-- Migration 24: Tabela de solicitações de busca de empreendedores
-- Criada para empresas do tipo "EMPRESA OU INICIATIVA INCENTIVADORA"

CREATE TABLE IF NOT EXISTS public.solicitacoes_busca (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cnaes         TEXT[]      NOT NULL,          -- até 3 CNAEs por solicitação
  cidade        TEXT        NOT NULL,
  modalidade    TEXT        NOT NULL            -- 'online' | 'presencial' | 'ambos'
                CHECK (modalidade IN ('online', 'presencial', 'ambos')),
  descricao     TEXT,
  documento_url TEXT,                           -- URL do arquivo no Storage do Supabase
  status        TEXT        NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para facilitar consultas por empresa
CREATE INDEX IF NOT EXISTS idx_solicitacoes_busca_empresa_id
  ON public.solicitacoes_busca (empresa_id);

-- Habilitar RLS
ALTER TABLE public.solicitacoes_busca ENABLE ROW LEVEL SECURITY;

-- Política: empresa pode inserir suas próprias solicitações
CREATE POLICY "empresa_pode_inserir_solicitacao_busca"
  ON public.solicitacoes_busca
  FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT eu.empresa_id
      FROM public.empresa_usuarios eu
      WHERE eu.auth_user_id = auth.uid()
    )
  );

-- Política: empresa pode ver suas próprias solicitações
CREATE POLICY "empresa_ve_suas_solicitacoes_busca"
  ON public.solicitacoes_busca
  FOR SELECT
  USING (
    empresa_id IN (
      SELECT eu.empresa_id
      FROM public.empresa_usuarios eu
      WHERE eu.auth_user_id = auth.uid()
    )
  );

-- Política: administradores podem ver e atualizar todas as solicitações
CREATE POLICY "adm_pode_ver_todas_solicitacoes_busca"
  ON public.solicitacoes_busca
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id IN (
        SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
      )
      AND e.tipo_usuario = 'adm'
    )
  );

-- Trigger para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_solicitacoes_busca_atualizado_em
  BEFORE UPDATE ON public.solicitacoes_busca
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atualizado_em();
