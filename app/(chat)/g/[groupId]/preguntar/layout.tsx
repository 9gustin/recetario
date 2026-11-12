/** Pantalla de chat: ocupa todo el alto, sin la barra inferior de la app. */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
