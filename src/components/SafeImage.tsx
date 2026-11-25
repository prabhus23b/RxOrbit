import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  lazy?: boolean;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  lazy = true,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 text-slate-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <GraduationCap className="h-8 w-8 text-teal-700/70 mb-1.5" />
        <span className="text-xs font-medium text-slate-600 px-3 text-center line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
