import { useState, useEffect } from 'react';

/**
 * Smooth count-up animation hook for metrics, revenue, and stats.
 * Uses requestAnimationFrame with ease-out cubic curve.
 * Automatically respects prefers-reduced-motion.
 */
export function useCountUp(targetNumber, duration = 1200) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    // Check user's motion preference
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const end = Number(targetNumber) || 0;

    if (prefersReducedMotion || duration <= 0) {
      setCurrent(end);
      return;
    }

    let startTimestamp = null;
    let frameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease-out cubic: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const val = easeProgress * end;

      setCurrent(val);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCurrent(end);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [targetNumber, duration]);

  return current;
}
