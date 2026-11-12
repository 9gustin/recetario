/** Las rutas del bucket `audio` son `<user_id>/<archivo>`; solo se aceptan las de la propia persona. */
export function isOwnAudioPath(path: string, userId: string): boolean {
  if (path.includes("..") || path.startsWith("/")) return false;
  const [folder, file, ...rest] = path.split("/");
  return (
    folder === userId && Boolean(file) && rest.length === 0 && /^[A-Za-z0-9._-]+$/.test(file ?? "")
  );
}
