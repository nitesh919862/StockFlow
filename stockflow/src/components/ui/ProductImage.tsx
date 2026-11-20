import { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = 'h-12 w-12' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0`}
        aria-label={alt}
      >
        <Package className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0`}
    />
  );
}
