interface StatusCardProps {
  label: string;
  value: string;
  detail: string;
}

export function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <article className="status-card">
      <p className="status-label">{label}</p>
      <p className="status-value">{value}</p>
      <p className="status-detail">{detail}</p>
    </article>
  );
}
