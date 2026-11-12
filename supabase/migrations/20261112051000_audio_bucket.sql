-- T5.2 — Bucket privado para los audios que se graban para transcribir.
-- Path: <user_id>/<uuid>.<ext>. Cada persona solo accede a su carpeta.
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 26214400)
on conflict (id) do nothing;

create policy "audio_owner_select" on storage.objects
  for select using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio_owner_insert" on storage.objects
  for insert with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio_owner_delete" on storage.objects
  for delete using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
