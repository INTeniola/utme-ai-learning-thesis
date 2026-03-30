-- RLS Policies for knowledge_graph (readable by all authenticated users)
CREATE POLICY "Authenticated users can view knowledge graph"
    ON public.knowledge_graph FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage knowledge graph"
    ON public.knowledge_graph FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for user_mastery_ledger
CREATE POLICY "Users can view their own mastery"
    ON public.user_mastery_ledger FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mastery"
    ON public.user_mastery_ledger FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mastery"
    ON public.user_mastery_ledger FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for exam_logs
CREATE POLICY "Users can view their own exam logs"
    ON public.exam_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exam logs"
    ON public.exam_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_graph_updated_at
  BEFORE UPDATE ON public.knowledge_graph
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_mastery_updated_at
  BEFORE UPDATE ON public.user_mastery_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user streak
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  last_date DATE;
  current_date_val DATE := CURRENT_DATE;
BEGIN
  SELECT last_activity_date INTO last_date
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  IF last_date IS NULL OR last_date < current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles
    SET current_streak = 1, last_activity_date = current_date_val
    WHERE id = NEW.user_id;
  ELSIF last_date = current_date_val - INTERVAL '1 day' THEN
    UPDATE public.profiles
    SET current_streak = current_streak + 1, last_activity_date = current_date_val
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update streak on exam log creation
CREATE TRIGGER on_exam_log_created
  AFTER INSERT ON public.exam_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_user_streak();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();