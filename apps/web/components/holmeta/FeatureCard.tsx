import { Panel } from "@/components/holmeta/Panel";

type FeatureCardProps = {
  title: string;
  body: string;
};

export function FeatureCard({ title, body }: FeatureCardProps) {
  return (
    <Panel as="article" className="hm-feature-card">
      <h3 className="hm-feature-title">{title}</h3>
      <p className="hm-meta">{body}</p>
    </Panel>
  );
}
