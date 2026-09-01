import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, RadioTower, RefreshCw, ShieldCheck } from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { ApiError, useAuth } from "../lib/auth";
import { getStoredLanguage, setStoredLanguage } from "../lib/i18n";
import { TEAM_AREAS } from "../lib/team";
import type { Language } from "../lib/types";

type Mode = "login" | "register";

export function AuthPage() {
  const auth = useAuth();
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(auth.hasOwner ? "login" : "register");
  }, [auth.hasOwner]);

  const c = language === "pt" ? {
    brandLine: "ENGENHARIA DE MISSÃO COLABORATIVA",
    loginTitle: "Entrar na equipe",
    registerTitle: auth.hasOwner ? "Criar conta de membro" : "Criar conta administradora",
    firstAccount: "A primeira conta será proprietária desta equipe.",
    name: "Nome completo",
    email: "E-mail",
    password: "Senha",
    passwordHint: "Use uma frase com pelo menos 15 caracteres.",
    institution: "Instituição",
    course: "Curso",
    stage: "Período ou etapa",
    area: "Área principal",
    skills: "Competências",
    skillsHint: "Separe por vírgulas",
    availability: "Horas por semana",
    inviteCode: "Código de convite",
    inviteHint: "Use o código enviado pela liderança da equipe.",
    enter: "Entrar",
    create: "Criar conta",
    noAccount: "Criar outra conta",
    hasAccount: "Já tenho conta",
    offlineTitle: "Serviço temporariamente indisponível",
    offlineText: "Tente novamente em alguns instantes.",
    retry: "Tentar novamente",
    loading: "Abrindo sessão segura"
  } : {
    brandLine: "COLLABORATIVE MISSION ENGINEERING",
    loginTitle: "Join the team",
    registerTitle: auth.hasOwner ? "Create member account" : "Create administrator account",
    firstAccount: "The first account will own this team.",
    name: "Full name",
    email: "Email",
    password: "Password",
    passwordHint: "Use a passphrase with at least 15 characters.",
    institution: "Institution",
    course: "Degree or course",
    stage: "Academic stage",
    area: "Primary area",
    skills: "Skills",
    skillsHint: "Separate with commas",
    availability: "Hours per week",
    inviteCode: "Invitation code",
    inviteHint: "Use the code shared by the team leadership.",
    enter: "Sign in",
    create: "Create account",
    noAccount: "Create another account",
    hasAccount: "I already have an account",
    offlineTitle: "Service temporarily unavailable",
    offlineText: "Try again in a few moments.",
    retry: "Try again",
    loading: "Opening secure session"
  };

  function changeLanguage(next: Language) {
    setLanguage(next);
    setStoredLanguage(next);
    document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        await auth.login(String(data.get("email") || ""), String(data.get("password") || ""));
      } else {
        await auth.register({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          password: String(data.get("password") || ""),
          institution: String(data.get("institution") || ""),
          course: String(data.get("course") || ""),
          academicStage: String(data.get("academicStage") || ""),
          primaryArea: String(data.get("primaryArea") || "systems") as (typeof TEAM_AREAS)[number]["id"],
          skills: String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
          availabilityHours: Number(data.get("availabilityHours") || 0),
          inviteCode: String(data.get("inviteCode") || "")
        });
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : (language === "pt" ? "Não foi possível concluir o acesso." : "Access could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === "loading") {
    return <div className="auth-status-screen"><RadioTower aria-hidden="true" /><span>{c.loading}</span></div>;
  }

  if (auth.status === "offline") {
    return (
      <div className="auth-status-screen auth-offline">
        <RadioTower aria-hidden="true" />
        <h1>{c.offlineTitle}</h1>
        <p>{c.offlineText}</p>
        <button onClick={() => void auth.refresh()}><RefreshCw aria-hidden="true" />{c.retry}</button>
      </div>
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <div className="auth-brand"><RadioTower aria-hidden="true" /><span>NORTE</span></div>
        <LanguageToggle language={language} onChange={changeLanguage} />
      </header>

      <section className="auth-layout">
        <div className="auth-context">
          <span>{c.brandLine}</span>
          <h1>NORTE</h1>
          <div className="auth-security-mark"><ShieldCheck aria-hidden="true" /><span>{language === "pt" ? "Sessão protegida" : "Protected session"}</span></div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form-heading">
            <div className="auth-form-icon">{mode === "login" ? <KeyRound aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}</div>
            <div><span>{mode === "login" ? "LOGIN" : "ACCOUNT"}</span><h2>{mode === "login" ? c.loginTitle : c.registerTitle}</h2></div>
          </div>

          {mode === "register" && !auth.hasOwner && <p className="auth-owner-note">{c.firstAccount}</p>}

          <div className="auth-fields">
            {mode === "register" && <label><span>{c.name}</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>}
            <label><span>{c.email}</span><input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label className={mode === "login" ? "auth-field-wide" : ""}><span>{c.password}</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 15} maxLength={128} /><small>{mode === "register" ? c.passwordHint : ""}</small></label>
            {mode === "register" && <label><span>{c.institution}</span><input name="institution" autoComplete="organization" required maxLength={160} /></label>}
            {mode === "register" && <label><span>{c.course}</span><input name="course" maxLength={120} /></label>}
            {mode === "register" && <label><span>{c.stage}</span><input name="academicStage" maxLength={80} placeholder={language === "pt" ? "Ex. 6º período" : "E.g. 3rd year"} /></label>}
            {mode === "register" && <label><span>{c.area}</span><select name="primaryArea" defaultValue="systems">{TEAM_AREAS.map((area) => <option key={area.id} value={area.id}>{area[language]}</option>)}</select></label>}
            {mode === "register" && <label><span>{c.skills}</span><input name="skills" maxLength={500} placeholder={c.skillsHint} /></label>}
            {mode === "register" && <label><span>{c.availability}</span><input name="availabilityHours" type="number" min={0} max={80} defaultValue={8} /></label>}
            {mode === "register" && auth.hasOwner && <label className="auth-field-wide"><span>{c.inviteCode}</span><input name="inviteCode" required maxLength={80} autoComplete="one-time-code" /><small>{c.inviteHint}</small></label>}
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <RefreshCw className="auth-spinner" aria-hidden="true" /> : mode === "login" ? <KeyRound aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{mode === "login" ? c.enter : c.create}</button>
          {auth.hasOwner && <button className="auth-mode-switch" type="button" onClick={() => { setMode((current) => current === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? c.noAccount : c.hasAccount}</button>}
        </form>
      </section>
    </main>
  );
}
