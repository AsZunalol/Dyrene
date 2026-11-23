"use client";

import type { ReactNode } from "react";
import { useTranslation } from "./LanguageProvider";
import HubIcon, { type HubIconName } from "@/components/HubIcon";

export default function PageHeader({ title, description, eyebrow = "Workspace", icon, actions }: {
  title: string;
  description: string;
  eyebrow?: string;
  icon: HubIconName;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="hub-page-header">
      <div className="hub-page-heading">
        <span className="hub-page-icon"><HubIcon name={icon} width="24" height="24" /></span>
        <div>
          <p className="hub-eyebrow">{t(eyebrow)}</p>
          <h1>{t(title)}</h1>
          <p className="hub-description">{t(description)}</p>
        </div>
      </div>
      {actions && <div className="hub-page-actions">{actions}</div>}
    </header>
  );
}
