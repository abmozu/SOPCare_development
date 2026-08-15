export default function ProjectLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return <span className={`project-logo ${compact ? "compact" : ""} ${light ? "light" : ""}`}>
    <span className="project-logo-art"><img src="/branding/sopcare-logo.png" alt="SOPCare" /></span>
    {compact && <small>Saudi Olympic and Paralympic Care</small>}
  </span>;
}
