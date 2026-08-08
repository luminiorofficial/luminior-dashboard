type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>{children}</div>;
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`border-b border-slate-100 px-5 py-4 ${className}`.trim()}>{children}</div>;
}

export function CardTitle({ children, className = "" }: CardProps) {
  return <h3 className={`text-base font-semibold text-slate-900 ${className}`.trim()}>{children}</h3>;
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`px-5 py-4 ${className}`.trim()}>{children}</div>;
}
