-- Adicionar constraint UNIQUE em (auth_user_id, empresa_id) para que o upsert funcione corretamente
-- quando o mesmo usuário é convidado para a mesma empresa mais de uma vez.

ALTER TABLE public.empresa_usuarios 
ADD CONSTRAINT empresa_usuarios_auth_user_id_empresa_id_key 
UNIQUE (auth_user_id, empresa_id);
