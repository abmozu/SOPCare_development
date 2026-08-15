export default function ProjectLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return <img
    className={`project-logo ${compact ? "compact" : ""} ${light ? "light" : ""}`}
    src="/branding/sopcare-logo-v2.png"
    alt="SOPCare — Saudi Olympic and Paralympic Care"
  />;
}
