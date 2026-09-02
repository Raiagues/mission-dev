export type AccessRole = "owner_admin" | "captain" | "manager" | "member" | "advisor";
export type MemberStatus = "demo" | "invited" | "active";
export type ArtifactKind = "official" | "document" | "repository" | "dataset" | "link";

export type SessionUser = {
  id: string;
  memberId: string;
  name: string;
  initials: string;
  email: string;
  accessRole: AccessRole;
  institution: string;
  primaryArea?: string;
};

export type TeamMember = {
  id: string;
  accountId: string | null;
  displayName: string;
  email: string;
  missionRole: string;
  primaryArea: string;
  secondaryAreas: string[];
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

export function memberInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function accessRoleLabel(role: AccessRole, language: Language): string {
  const labels: Record<AccessRole, Record<Language, string>> = {
    owner_admin: { pt: "Proprietário e administrador", en: "Owner and administrator" },
    captain: { pt: "Capitão", en: "Captain" },
    manager: { pt: "Gerente", en: "Manager" },
    member: { pt: "Membro", en: "Member" },
    advisor: { pt: "Orientador", en: "Advisor" }
  };
  return labels[role][language];
}
import type { Language } from "./types";
