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
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.00 9.80L12.00 2.80M12.00 7.10L9.75 5.80M12.00 7.10L14.25 5.80M12.00 4.70L10.53 3.85M12.00 4.70L13.47 3.85M13.91 10.90L19.97 7.40M16.24 9.55L16.24 6.95M16.24 9.55L18.50 10.85M18.32 8.35L18.32 6.65M18.32 8.35L19.79 9.20M13.91 13.10L19.97 16.60M16.24 14.45L18.50 13.15M16.24 14.45L16.24 17.05M18.32 15.65L19.79 14.80M18.32 15.65L18.32 17.35M12.00 14.20L12.00 21.20M12.00 16.90L14.25 18.20M12.00 16.90L9.75 18.20M12.00 19.30L13.47 20.15M12.00 19.30L10.53 20.15M10.09 13.10L4.03 16.60M7.76 14.45L7.76 17.05M7.76 14.45L5.50 13.15M5.68 15.65L5.68 17.35M5.68 15.65L4.21 14.80M10.09 10.90L4.03 7.40M7.76 9.55L5.50 10.85M7.76 9.55L7.76 6.95M5.68 8.35L4.21 9.20M5.68 8.35L5.68 6.65" />
        <path d="M12.00 9.80L13.91 10.90L13.91 13.10L12.00 14.20L10.09 13.10L10.09 10.90Z" />
      </svg>
    </span>
  );
}
