import type { Language } from "./types";

export type AccessRole = "owner_admin" | "captain" | "manager" | "member" | "advisor";
export type MissionRole = "captain" | "manager" | "member" | "advisor";
export type MemberStatus = "demo" | "invited" | "active";
export type TeamAreaId =
  | "systems"
  | "mission_payload"
  | "project_management"
  | "structures_thermal"
  | "eps_power"
  | "obc_avionics"
  | "flight_software"
  | "communications_ground"
  | "adcs_gnc"
  | "ait_testing"
  | "operations_orbit"
  | "safety_regulatory"
  | "finance_procurement"
  | "outreach_documentation";

export type ArtifactKind = "official" | "document" | "repository" | "dataset" | "link";

export type SessionUser = {
  id: string;
  memberId: string;
  name: string;
  initials: string;
  email: string;
  accessRole: AccessRole;
  institution: string;
  primaryArea: TeamAreaId;
};

export type TeamMember = {
  id: string;
  accountId: string | null;
  displayName: string;
  email: string;
  missionRole: MissionRole;
  primaryArea: TeamAreaId;
  secondaryAreas: TeamAreaId[];
  institution: string;
  course: string;
  academicStage: string;
  skills: string[];
  availabilityHours: number;
  notes: string;
  accountStatus: MemberStatus;
  accessRole: AccessRole | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectedArtifact = {
  id: string;
  kind: ArtifactKind;
  label: string;
  url: string;
  description: string;
  tags: string[];
  official: boolean;
  createdBy: string | null;
  connectedAt: string;
  updatedAt: string;
};

type LocalizedOption<T extends string> = {
  id: T;
  pt: string;
  en: string;
};

export const TEAM_AREAS: LocalizedOption<TeamAreaId>[] = [
  { id: "systems", pt: "Sistemas e integração", en: "Systems and integration" },
  { id: "mission_payload", pt: "Missão e carga útil", en: "Mission and payload" },
  { id: "project_management", pt: "Gestão do projeto", en: "Project management" },
  { id: "structures_thermal", pt: "Estruturas e térmica", en: "Structures and thermal" },
  { id: "eps_power", pt: "Potência (EPS)", en: "Power (EPS)" },
  { id: "obc_avionics", pt: "OBC e aviónica", en: "OBC and avionics" },
  { id: "flight_software", pt: "Software de voo", en: "Flight software" },
  { id: "communications_ground", pt: "Comunicações e segmento solo", en: "Communications and ground segment" },
  { id: "adcs_gnc", pt: "ADCS / GNC", en: "ADCS / GNC" },
  { id: "ait_testing", pt: "Integração e testes (AIT)", en: "Integration and testing (AIT)" },
  { id: "operations_orbit", pt: "Operações e análise orbital", en: "Operations and orbit analysis" },
  { id: "safety_regulatory", pt: "Segurança e regulação", en: "Safety and regulation" },
  { id: "finance_procurement", pt: "Finanças, compras e patrocínio", en: "Finance, procurement and sponsorship" },
  { id: "outreach_documentation", pt: "Comunicação e documentação", en: "Outreach and documentation" }
];

export const MISSION_ROLES: LocalizedOption<MissionRole>[] = [
  { id: "captain", pt: "Capitão da equipe", en: "Team captain" },
  { id: "manager", pt: "Gerente de área", en: "Area manager" },
  { id: "member", pt: "Membro", en: "Member" },
  { id: "advisor", pt: "Orientador", en: "Advisor" }
];

export const ACCESS_ROLES: LocalizedOption<AccessRole>[] = [
  { id: "owner_admin", pt: "Proprietário e admin", en: "Owner and admin" },
  { id: "captain", pt: "Capitão", en: "Captain" },
  { id: "manager", pt: "Gerente", en: "Manager" },
  { id: "member", pt: "Membro", en: "Member" },
  { id: "advisor", pt: "Orientador", en: "Advisor" }
];

export function optionLabel<T extends string>(options: LocalizedOption<T>[], id: T, language: Language): string {
  const option = options.find((item) => item.id === id);
  return option ? option[language] : id;
}

export function teamAreaLabel(id: TeamAreaId, language: Language): string {
  return optionLabel(TEAM_AREAS, id, language);
}

export function missionRoleLabel(id: MissionRole, language: Language): string {
  return optionLabel(MISSION_ROLES, id, language);
}

export function accessRoleLabel(id: AccessRole, language: Language): string {
  return optionLabel(ACCESS_ROLES, id, language);
}

export function memberInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
