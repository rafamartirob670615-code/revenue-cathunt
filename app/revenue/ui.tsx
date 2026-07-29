export function ModuleHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="module-head">
      <div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
      {action}
    </header>
  );
}

export function Metric({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return <article className={`paper-metric ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small></article>;
}

export function EmptyAnswer({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return <section className="empty-answer"><span>→</span><div><h2>{title}</h2><p>{copy}</p></div>{action}</section>;
}

export function formatMoney(value: number, currency = "MXN") {
  return value.toLocaleString("es-MX", { style: "currency", currency, maximumFractionDigits: 0 });
}
