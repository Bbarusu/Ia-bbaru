import type { LucideIcon } from "lucide-react";
import type { Tab } from "../types";

interface MobileNavProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  tabs: { id: Tab; label: string; icon: LucideIcon }[];
}

export function MobileNav({ tab, setTab, tabs }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Navegação compacta">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          type="button"
          key={id}
          aria-label={label}
          title={label}
          aria-current={tab === id ? "page" : undefined}
          onClick={() => setTab(id)}
          className={tab === id ? "active" : ""}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
