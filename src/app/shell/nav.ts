import type { Role } from "../../types";
import { Activity, FileSearch, LayoutGrid, ScrollText, ShieldCheck, Stethoscope, Wallet } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/overview", label: "Overview", icon: LayoutGrid, roles: ["doctor", "billing", "compliance", "admin"] },
  { to: "/doctor-review", label: "Doctor Review", icon: Stethoscope, roles: ["doctor", "admin"] },
  { to: "/documentation", label: "Documentation", icon: FileSearch, roles: ["billing", "admin"] },
  { to: "/billing", label: "Billing", icon: Wallet, roles: ["billing", "admin"] },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck, roles: ["compliance", "admin"] },
  { to: "/observability", label: "Observability", icon: Activity, roles: ["doctor", "billing", "compliance", "admin"] },
  { to: "/audit-trail", label: "Audit Trail", icon: ScrollText, roles: ["doctor", "billing", "compliance", "admin"] },
];

export const ROLE_LABEL: Record<Role, string> = {
  doctor: "Doctor",
  billing: "Billing Coordinator",
  compliance: "Compliance Officer",
  admin: "Administrator",
};
