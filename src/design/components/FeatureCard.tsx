import type React from "react";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadge";

interface FeatureCardProps {
  title: string;
  description: string;
  status: React.ReactNode;
  statusTone: StatusBadgeTone;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  status,
  statusTone,
  children,
  actions,
}) => {
  return (
    <section className="design-feature-card" aria-labelledby={`${title}-title`}>
      <div className="design-feature-card__header">
        <div className="design-feature-card__heading">
          <h3 className="design-feature-card__title" id={`${title}-title`}>
            {title}
          </h3>
          <p className="design-feature-card__description">{description}</p>
        </div>
        <StatusBadge tone={statusTone}>{status}</StatusBadge>
      </div>
      <div className="design-feature-card__body">{children}</div>
      {actions && <div className="design-feature-card__actions">{actions}</div>}
    </section>
  );
};
