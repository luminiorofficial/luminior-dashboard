type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
