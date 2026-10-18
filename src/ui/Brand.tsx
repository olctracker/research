export const APP_NAME = "HEDB";
export const APP_TAGLINE = "Hack EX2 Upgrade Database";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <rect width="512" height="512" rx="112" fill="var(--logo-bg)" />
      <path d="M128 352 L208 272 L272 320 L384 176" fill="none" stroke="var(--accent)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M320 176 H384 V240" fill="none" stroke="var(--accent)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ large }: { large?: boolean }) {
  return (
    <div className={`brand${large ? " large" : ""}`}>
      <Logo size={large ? 64 : 30} />
      <div>
        <div className="brand-name">{APP_NAME}</div>
        {large && <div className="brand-tag">{APP_TAGLINE}</div>}
      </div>
    </div>
  );
}
