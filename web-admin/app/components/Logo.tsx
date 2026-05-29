export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        width="36"
        height="36"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* towel / shirt shape */}
        <path
          d="M20 30 Q50 5 80 30 L70 85 Q50 95 30 85 Z"
          fill="#2563eb"
        />

        {/* water bubble */}
        <circle cx="65" cy="35" r="6" fill="#60a5fa" />
      </svg>

      <span className="font-bold text-xl tracking-wide text-current">
        WASHWARE
      </span>
    </div>
  );
}
