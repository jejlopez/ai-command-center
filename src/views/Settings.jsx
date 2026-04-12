import { useState } from "react";
import { KeyRound, Wallet, ShieldCheck, Lock, Info, Plug, ScrollText, LogOut, Palette } from "lucide-react";
import { ProvidersPanel } from "../components/settings/ProvidersPanel.jsx";
import { ConnectorsPanel } from "../components/settings/ConnectorsPanel.jsx";
import { BudgetPanel } from "../components/settings/BudgetPanel.jsx";
import { PrivacyPanel } from "../components/settings/PrivacyPanel.jsx";
import { VaultPanel } from "../components/settings/VaultPanel.jsx";
import { AuditPanel } from "../components/settings/AuditPanel.jsx";
import { AboutPanel } from "../components/settings/AboutPanel.jsx";
import { ThemePanel } from "../components/settings/ThemePanel.jsx";
import { useAuth } from "../hooks/useAuth.js";

const TABS = [
 { id: "providers", label: "Providers", Icon: KeyRound, Component: ProvidersPanel },
 { id: "connectors", label: "Connectors", Icon: Plug, Component: ConnectorsPanel },
 { id: "budget", label: "Budget", Icon: Wallet, Component: BudgetPanel },
 { id: "privacy", label: "Privacy", Icon: ShieldCheck, Component: PrivacyPanel },
 { id: "vault", label: "Vault", Icon: Lock, Component: VaultPanel },
 { id: "audit", label: "Audit Log", Icon: ScrollText, Component: AuditPanel },
 { id: "theme", label: "Theme", Icon: Palette, Component: ThemePanel },
 { id: "about", label: "About", Icon: Info, Component: AboutPanel },
];

export default function Settings() {
 const [tab, setTab] = useState("providers");
 const auth = useAuth();
 const active = TABS.find((t) => t.id === tab) ?? TABS[0];
 const ActiveComponent = active.Component;

 const handleSignOut = async () => {
 await auth.signOut();
 localStorage.removeItem("jarvis_local_mode");
 window.location.reload();
 };

 return (
 <div className="h-full w-full flex min-h-0">
 <nav className="w-60 shrink-0 p-4 border-r border-jarvis-border bg-jarvis-surface/20 flex flex-col">
 <div className="px-2 mb-4">
 <div className="label">Settings</div>
 <div className="text-[11px] text-jarvis-muted mt-0.5">Runtime configuration</div>
 </div>
 <div className="flex flex-col gap-1">
 {TABS.map(({ id, label, Icon }) => {
 const isActive = id === tab;
 return (
 <button
 key={id}
 type="button"
 onClick={() => setTab(id)}
 className={[
 "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition text-left",
 isActive
 ? "bg-jarvis-primary-muted text-jarvis-primary"
 : "text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
 ].join(" ")}
 >
 <Icon size={16} strokeWidth={1.8} />
 <span className="font-medium">{label}</span>
 </button>
 );
 })}
 </div>

 {/* Sign out */}
 <div className="mt-auto pt-4 border-t border-jarvis-border/30">
 {auth.user && (
 <div className="px-3 mb-2 text-[11px] text-jarvis-muted truncate">
 {auth.user.email}
 </div>
 )}
 <button
 type="button"
 onClick={handleSignOut}
 className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-jarvis-red/70 hover:text-jarvis-red hover:bg-jarvis-red/5 transition w-full text-left"
 >
 <LogOut size={16} strokeWidth={1.8} />
 <span className="font-medium">Sign out</span>
 </button>
 </div>
 </nav>

 <section className="flex-1 min-w-0 overflow-y-auto">
 <div className="max-w-4xl mx-auto px-8 py-8">
 <div className="surface p-8">
 <ActiveComponent />
 </div>
 </div>
 </section>
 </div>
 );
}
