import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';

interface TrackArtworkProps {
  src?: string;
  alt?: string;
  className?: string;
  iconClassName?: string;
}

export function TrackArtwork({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  iconClassName = 'w-6 h-6 text-zinc-500',
}: TrackArtworkProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
        <Disc3 className={iconClassName} strokeWidth={1} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export default TrackArtwork;
