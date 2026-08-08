export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
