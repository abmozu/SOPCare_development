export default function BrandLogos({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return <span className={`brand-logos ${compact ? "compact" : ""} ${dark ? "dark" : ""}`}>
    <img className="team-saudi-logo" src="/branding/team-saudi.png" alt="Team Saudi" />
    <span className="brand-logo-divider" />
    <img className="olympic-logo" src="/branding/saudi-olympic-paralympic.png" alt="Saudi Olympic and Paralympic Committee" />
  </span>;
}
