import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const LawyerPhoto = ({
  src,
  alt,
  className,
  iconClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}) => {
  const normalizedSrc = src?.trim();
  const [failedSrc, setFailedSrc] = useState("");

  if (normalizedSrc && failedSrc !== normalizedSrc) {
    return <img src={normalizedSrc} alt={alt} className={className} onError={() => setFailedSrc(normalizedSrc)} />;
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("flex shrink-0 items-center justify-center bg-muted text-muted-foreground", className)}
    >
      <UserRound className={cn("h-1/2 w-1/2", iconClassName)} aria-hidden="true" />
    </div>
  );
};

export default LawyerPhoto;
