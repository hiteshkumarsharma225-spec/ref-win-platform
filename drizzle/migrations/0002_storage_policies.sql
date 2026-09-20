CREATE POLICY "upload own screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'result-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "read screenshots" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'result-screenshots');

CREATE POLICY "upload own kyc" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "read own kyc" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));