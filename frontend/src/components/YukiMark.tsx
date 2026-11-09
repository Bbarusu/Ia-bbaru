interface YukiMarkProps {
  size?: "sm" | "md";
  small?: boolean;
}

export function YukiMark({ size = "md", small = false }: YukiMarkProps) {
  const isSmall = small || size === "sm";
  const iconSize = isSmall ? 14 : 18;
  return (
    <span
      className={`yuki-mark ${isSmall ? "small" : ""}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        fill="none"
        stroke="#07090d"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v20M19.07 4.93 4.93 19.07M22 12H2M19.07 19.07 4.93 4.93" />
        <path d="m10 4 2 2 2-2M14 20l-2-2-2 2M4 10l2 2-2 2M20 14l-2-2 2-2" />
      </svg>
    </span>
  );
}
