import type React from "react";
import { useEffect, useId, useRef } from "react";

interface SettingsSectionProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  autoFocusTitle?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  autoFocusTitle = false,
}) => {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (autoFocusTitle) {
      titleRef.current?.focus();
    }
  }, [autoFocusTitle]);

  return (
    <section className="design-settings-section" aria-labelledby={titleId}>
      <header className="design-settings-section__header">
        <span className="design-settings-section__eyebrow">Preferences</span>
        <h2
          ref={titleRef}
          className="design-settings-section__title"
          id={titleId}
          tabIndex={autoFocusTitle ? -1 : undefined}
        >
          {title}
        </h2>
        {description && (
          <p className="design-settings-section__description">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
};
