import React from 'react';

export const FilterIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Funnel */}
      <path 
        d="M3 6C3 5.44772 3.44772 5 4 5H20C20.5523 5 21 5.44772 21 6V7.58579C21 7.851 20.8946 8.10536 20.7071 8.29289L14.2929 14.7071C14.1054 14.8946 14 15.149 14 15.4142V19.5858C14 20.1204 13.3544 20.3882 12.9764 20.0102L10.9764 18.0102C10.3516 17.3854 10 16.5379 10 15.6541V15.4142C10 15.149 9.89464 14.8946 9.70711 14.7071L3.29289 8.29289C3.10536 8.10536 3 7.851 3 7.58579V6Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Bubbles */}
      <circle cx="15" cy="3" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="9" cy="2" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="19" cy="4" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
};
