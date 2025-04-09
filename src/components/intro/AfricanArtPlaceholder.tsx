"use client";

import React from 'react';

interface ArtPlaceholderProps {
  title: string;
  colorStart: string;
  colorEnd: string;
  pattern?: 'dots' | 'lines' | 'geometric' | 'waves';
  className?: string;
}

export default function AfricanArtPlaceholder({ 
  title, 
  colorStart, 
  colorEnd, 
  pattern = 'geometric',
  className = ''
}: ArtPlaceholderProps) {
  const patternElements = () => {
    switch (pattern) {
      case 'dots':
        return (
          <g fill="currentColor" opacity="0.3">
            <circle cx="25%" cy="25%" r="10" />
            <circle cx="50%" cy="50%" r="15" />
            <circle cx="75%" cy="25%" r="8" />
            <circle cx="25%" cy="75%" r="12" />
            <circle cx="75%" cy="75%" r="7" />
          </g>
        );
      case 'lines':
        return (
          <g stroke="currentColor" strokeWidth="2" opacity="0.3">
            <line x1="0" y1="20%" x2="100%" y2="20%" />
            <line x1="0" y1="40%" x2="100%" y2="40%" />
            <line x1="0" y1="60%" x2="100%" y2="60%" />
            <line x1="0" y1="80%" x2="100%" y2="80%" />
          </g>
        );
      case 'waves':
        return (
          <path 
            d="M0,50 C50,30 50,70 100,50 C150,30 150,70 200,50 C250,30 250,70 300,50" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            opacity="0.3" 
            transform="translate(0, 60)"
          />
        );
      case 'geometric':
      default:
        return (
          <g fill="currentColor" opacity="0.3">
            <polygon points="50,10 90,50 50,90 10,50" />
            <rect x="10" y="10" width="30" height="30" />
            <rect x="60" y="60" width="30" height="30" />
          </g>
        );
    }
  };
  
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        className="absolute inset-0"
      >
        <defs>
          <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} gradientTransform="rotate(45)">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
        <rect 
          width="100%" 
          height="100%" 
          fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
        />
        {patternElements()}
      </svg>
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/80 px-4 py-2 rounded-lg shadow-md">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
      </div>
    </div>
  );
} 