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
        d="M16 9.6v4.2M16 18.2v4.2M10 12.8l3.4 2M18.6 17.2l3.4 2M22 12.8l-3.4 2M13.4 17.2 10 19.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}