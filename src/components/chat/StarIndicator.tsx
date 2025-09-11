'use client';
export default function StarIndicator() {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-6 h-6 text-violet-500 animate-pulse-star"
        fill="currentColor"
        viewBox="0 0 24 24"
        stroke="none"
        style={{ filter: 'drop-shadow(0 0 6px violet)' }}
      >
        <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
      </svg>
    )
  }