import Image from "next/image";
import { IMAGES } from "@/lib/images";
import { cn } from "@/lib/cn";

/** Shared Orbitron lockup for the trust brand row */
const trustWordmarkClass =
  "font-display text-xs font-semibold uppercase tracking-[0.16em] text-white/55 md:text-sm md:tracking-[0.18em]";

const trustIconClass = "h-12 w-12 shrink-0 object-contain opacity-80 md:h-14 md:w-14";

/**
 * GE Healthcare — monogram + Orbitron wordmark (specialty framing, not a partnership badge).
 */
export function GeHealthcareMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 md:gap-3", className)}
      title="Specializing in GE Healthcare PET/CT systems"
    >
      <Image
        src={IMAGES.geMonogram}
        alt=""
        width={256}
        height={256}
        unoptimized
        className={trustIconClass}
      />
      <span className={trustWordmarkClass}>GE Healthcare</span>
    </span>
  );
}

export function PetCtMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 md:gap-3", className)}
      aria-label="PET/CT systems"
    >
      <Image
        src={IMAGES.petCtMark}
        alt=""
        width={512}
        height={512}
        unoptimized
        className={trustIconClass}
      />
      <span className={trustWordmarkClass}>PET/CT</span>
    </span>
  );
}

type TitanMarkIconProps = {
  className?: string;
  size?: "hero" | "trust";
};

/** Circle scanner mark only — no wordmark */
export function TitanMarkIcon({ className, size = "hero" }: TitanMarkIconProps) {
  return (
    <Image
      src={IMAGES.logoMark}
      alt=""
      width={512}
      height={512}
      unoptimized
      className={cn(
        "shrink-0 bg-transparent object-contain",
        size === "hero"
          ? "mx-auto h-20 w-20 md:h-28 md:w-28 lg:h-32 lg:w-32"
          : trustIconClass,
        className,
      )}
      priority={size === "hero"}
    />
  );
}

/** Orbitron wordmark without the circle icon */
export function TitanWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[0.65rem] font-bold uppercase leading-none tracking-[0.14em] text-white min-[400px]:text-[0.7rem] sm:text-xs sm:tracking-[0.16em] md:text-sm md:tracking-[0.18em]",
        className,
      )}
    >
      <span className="hidden min-[480px]:inline">Titan Imaging Service</span>
      <span className="min-[480px]:hidden">Titan</span>
    </span>
  );
}

type TitanMarkProps = {
  className?: string;
  size?: "nav" | "trust";
};

/**
 * Titan mark: scanner icon + Orbitron “Titan Imaging Service”.
 */
export function TitanMark({ className, size = "nav" }: TitanMarkProps) {
  const isTrust = size === "trust";

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 md:gap-3",
        isTrust && "opacity-90",
        className,
      )}
    >
      <Image
        src={IMAGES.logoMark}
        alt=""
        width={512}
        height={512}
        unoptimized
        className={cn(
          "shrink-0 bg-transparent object-contain",
          isTrust
            ? trustIconClass
            : "h-7 w-7 sm:h-8 sm:w-8",
        )}
        priority={size === "nav"}
      />
      {isTrust ? (
        <span className={trustWordmarkClass}>Titan Imaging Service</span>
      ) : (
        <TitanWordmark />
      )}
    </span>
  );
}
