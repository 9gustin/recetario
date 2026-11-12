-- T5B.1 — Conversaciones del asistente ("Preguntale"): escritura propia e índice de menciones.
-- Las columnas context/title/last_message_at/mentions ya existen (migración de IA).

-- Una persona crea y edita sus conversaciones en grupos donde es miembro; nadie ve las de otra persona.
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert with check (user_id = auth.uid() and public.is_group_member(group_id));
create policy "ai_conversations_update_own" on public.ai_conversations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete using (user_id = auth.uid());

create policy "ai_messages_insert_own" on public.ai_messages
  for insert with check (
    exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- "Preguntas sobre esta receta": mensajes que citan una receta.
create index ai_messages_mentions_idx on public.ai_messages using gin (mentions);
