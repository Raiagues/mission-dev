import { useEffect, useRef, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { accessRoleLabel } from "../lib/team";

type Props = {
  connectedLabel: string;
  compact?: boolean;
};

export function UserBadge({ connectedLabel, compact = false }: Props) {
  const { user, logout, isDemo } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const language = document.documentElement.lang.startsWith("en") ? "en" : "pt";

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  if (!user) return null;

  return (
    <div className={compact ? "user-badge compact account-badge" : "user-badge account-badge"} ref={rootRef}>
      <button className="account-badge-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={user.name}>
        <div className="avatar">{user.initials}</div>
        {!compact && <div className="user-copy"><div className="user-name">{user.name}</div><div className="user-state"><span className="online-dot" />{connectedLabel}</div></div>}
      </button>
      {open && (
        <div className="account-menu">
          <div className="account-menu-head"><ShieldCheck aria-hidden="true" /><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
          <div className="account-menu-role">{isDemo ? (language === "pt" ? "Demonstração local" : "Local demo") : accessRoleLabel(user.accessRole, language)}</div>
          {!isDemo && <button type="button" onClick={() => void logout()}><LogOut aria-hidden="true" />{language === "pt" ? "Sair" : "Sign out"}</button>}
        </div>
      )}
    </div>
  );
}
