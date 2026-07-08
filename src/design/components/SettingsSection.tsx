import type React from "react";
import { useId } from "react";

interface SettingsSectionProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
}) => {
  const titleId = useId();

  return (
    <section className="design-settings-section" aria-labelledby={titleId}>
      <h2 className="design-settings-section__title" id={titleId}>
        {title}
      </h2>
      {description && (
        <p className="design-settings-section__description">{description}</p>
      )}
      {children}
    </section>
  );
};
