import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

const ENTRANCE_DURATION = 0.9;
const ENTRANCE_STAGGER = 0.08;
const ENTRANCE_EASE = "power3.out";

/**
 * Plays a staggered 3D-flip entrance over every `[data-reveal]` descendant of
 * `ref`, in DOM order. Reverts to a static, fully-visible state when the user
 * prefers reduced motion. Re-runs when `deps` change.
 */
export function useStaggerReveal(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (targets.length === 0) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        animate: "(prefers-reduced-motion: no-preference)",
        reduce: "(prefers-reduced-motion: reduce)",
      },
      (ctx) => {
        const { reduce } = ctx.conditions as { reduce: boolean };

        if (reduce) {
          gsap.set(targets, { autoAlpha: 1, y: 0, rotationX: 0 });
          return;
        }

        gsap.set(targets, {
          transformPerspective: 600,
          transformOrigin: "center bottom",
        });
        gsap.from(targets, {
          yPercent: 110,
          autoAlpha: 0,
          rotationX: -90,
          duration: ENTRANCE_DURATION,
          ease: ENTRANCE_EASE,
          stagger: ENTRANCE_STAGGER,
        });
      },
    );

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
