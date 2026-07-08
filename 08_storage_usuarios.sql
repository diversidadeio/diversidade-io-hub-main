-- Habilitando uploads no bucket 'documentos' para fotos de perfil

-- Permitir INSERT para usuários autenticados
CREATE POLICY "Permitir upload de foto de perfil"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'usuarios' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir UPDATE (sobrescrever foto)
CREATE POLICY "Permitir atualizar foto de perfil"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'usuarios' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Permitir SELECT público (já deve existir para documentos, mas garantindo)
CREATE POLICY "Permitir ler foto de perfil"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'usuarios'
);
