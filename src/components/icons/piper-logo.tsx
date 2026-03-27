import { cn } from "@/lib/utils";

type PiperLogoProps = {
  className?: string;
};

export function PiperLogo({ className }: PiperLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-9 w-9 text-[var(--on-surface)]", className)}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="6" width="36" height="36" rx="14" fill="url(#piper-logo-gradient)" />
      <path
        d="M17 33V15H25.5C30.1944 15 34 18.5817 34 23C34 27.4183 30.1944 31 25.5 31H21V33H17Z"
        fill="white"
        fillOpacity="0.98"
      />
      <path d="M21 19V27H25.25C27.5972 27 29.5 25.2091 29.5 23C29.5 20.7909 27.5972 19 25.25 19H21Z" fill="#D9E4F6" />
      <defs>
        <linearGradient id="piper-logo-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-container)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
