CREATE POLICY "No client access to integration config"
  ON public.integration_config
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);