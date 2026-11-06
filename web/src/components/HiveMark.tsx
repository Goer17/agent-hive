interface HiveMarkProps {
  size?: number;
  className?: string;
}

export function HiveMark({ size = 28, className }: HiveMarkProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 3.2 27 9.4v13.2L16 28.8 5 22.6V9.4L16 3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M16 16 16 6.5M16 16 24.5 11M16 16 24.5 21M16 16 16 25.5M16 16 7.5 21M16 16 7.5 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}