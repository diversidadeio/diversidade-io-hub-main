-- Criação da tabela empresa_usuarios
CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  
  -- Dados do usuário convidado
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  foto_url TEXT,
  
  -- Papel e acesso
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'usuario')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo')),

  -- Preferências pessoais
  tema_escuro BOOLEAN NOT NULL DEFAULT false,

  -- Rastreabilidade
  convidado_por UUID REFERENCES public.empresa_usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (RLS)

-- 1. Qualquer usuário autenticado pode ler os usuários da sua empresa
CREATE POLICY "Usuários podem ver membros da sua empresa" 
ON public.empresa_usuarios FOR SELECT 
TO authenticated 
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.empresa_usuarios WHERE email = auth.jwt() ->> 'email'
  )
  OR 
  empresa_id IN (
    SELECT id FROM public.empresas WHERE email = auth.jwt() ->> 'email'
  )
);

-- 2. Administradores podem inserir novos usuários
CREATE POLICY "Administradores podem inserir usuários" 
ON public.empresa_usuarios FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE email = auth.jwt() ->> 'email' AND papel = 'admin' AND empresa_id = empresa_usuarios.empresa_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.empresas
    WHERE email = auth.jwt() ->> 'email' AND id = empresa_usuarios.empresa_id
  )
);

-- 3. Administradores podem deletar usuários da sua empresa
CREATE POLICY "Administradores podem deletar usuários" 
ON public.empresa_usuarios FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE email = auth.jwt() ->> 'email' AND papel = 'admin' AND empresa_id = empresa_usuarios.empresa_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.empresas
    WHERE email = auth.jwt() ->> 'email' AND id = empresa_usuarios.empresa_id
  )
);

-- 4. O próprio usuário pode atualizar seus dados (nome, telefone, foto, tema) ou admins podem atualizar status/papel
CREATE POLICY "Usuários e admins podem atualizar dados" 
ON public.empresa_usuarios FOR UPDATE 
TO authenticated 
USING (
  email = auth.jwt() ->> 'email' -- O próprio usuário
  OR
  EXISTS ( -- Um admin da mesma empresa
    SELECT 1 FROM public.empresa_usuarios 
    WHERE email = auth.jwt() ->> 'email' AND papel = 'admin' AND empresa_id = empresa_usuarios.empresa_id
  )
  OR
  EXISTS ( -- O criador da empresa
    SELECT 1 FROM public.empresas
    WHERE email = auth.jwt() ->> 'email' AND id = empresa_usuarios.empresa_id
  )
);
