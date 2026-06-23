
CREATE POLICY "Admins can read prompt pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prompt-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload prompt pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prompt-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete prompt pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prompt-pdfs' AND public.has_role(auth.uid(), 'admin'));
