interface StatusCardProps {
  label: string;
  value: string;
  detail: string;
}

export function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <article className="hm-status-card">
      <p className="hm-kicker">{label}</p>
      <p className="hm-status-value">{value}</p>
      <p className="hm-meta">{detail}</p>
    </article>
  );
}
