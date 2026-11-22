import type { ReactNode } from "react";
import HubIcon, { type HubIconName } from "@/components/HubIcon";

export default function PageHeader({ title, description, eyebrow = "Workspace", icon, actions }: {
  title: string;
  description: string;
  eyebrow?: string;
  icon: HubIconName;
  actions?: ReactNode;
}) {
  return (
    <header className="hub-page-header">
      <div className="hub-page-heading">
        <span className="hub-page-icon"><HubIcon name={icon} width="24" height="24" /></span>
        <div>
          <p className="hub-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hub-description">{description}</p>
        </div>
      </div>
      {actions && <div className="hub-page-actions">{actions}</div>}
    </header>
  );
}
