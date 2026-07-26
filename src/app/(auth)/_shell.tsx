/** Kimlik doğrulama ekranlarının ortak kabuğu — 06 §16.1 (onaylı wireframe). */
export function AuthShell({
  step,
  title,
  children,
  footNote,
}: {
  step?: string;
  title: string;
  children: React.ReactNode;
  footNote?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4 py-10">
      <div className="mb-6 flex items-baseline">
        <span className="font-display text-2xl font-semibold tracking-wide text-gold-500">
          PIRAVEL
        </span>
        <span className="ml-1.5 text-2xl font-light text-shell-muted">OS</span>
      </div>

      <div className="w-full max-w-[400px] rounded-md border border-line-200 bg-surface p-6 shadow-lg">
        {step && (
          <div className="mb-1 text-xs font-medium tracking-widest text-ink-400">{step}</div>
        )}
        <h1 className="mb-5 text-lg font-semibold text-ink-900">{title}</h1>
        {children}
      </div>

      <p className="mt-5 max-w-[400px] text-center text-xs text-shell-muted">
        {footNote ?? "Piravel OS — yalnızca yetkili kullanıcılar içindir."}
      </p>
    </div>
  );
}
