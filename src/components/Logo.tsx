export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M6 8.5V15.5" stroke="var(--color-accent)" strokeWidth="1.6" />
      <path d="M8.2 6.8C12 7.5 14 9 16 11" stroke="var(--color-lane-3)" strokeWidth="1.6" />
      <path d="M8.2 17.2C12 16.5 14 15 16 13" stroke="var(--color-lane-2)" strokeWidth="1.6" />
      <circle cx="6" cy="6" r="2.6" fill="var(--color-accent)" />
      <circle cx="6" cy="18" r="2.6" fill="var(--color-lane-2)" />
      <circle cx="18" cy="12" r="2.6" fill="var(--color-lane-3)" />
    </svg>
  );
}
