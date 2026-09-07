/** Fixed left/right black vignette — full viewport height so transparent nav picks up the same edge fade. Desktop only. */
export function PrototypeSideVignette() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-y-0 left-0 z-40 hidden w-16 bg-gradient-to-r from-black via-black/70 to-transparent md:block lg:w-24 xl:w-28"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-y-0 right-0 z-40 hidden w-16 bg-gradient-to-l from-black via-black/70 to-transparent md:block lg:w-24 xl:w-28"
        aria-hidden
      />
    </>
  );
}
