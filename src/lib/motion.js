// Cinematic animation presets for Framer Motion.
// Import these in any view/component for consistent stagger + entrance.

export const stagger = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export const slideUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// Animated counter — counts from 0 to target over 800ms
export function countUp(target, duration = 800) {
  return {
    from: 0,
    to: target,
    duration: duration / 1000,
    ease: [0.22, 1, 0.36, 1],
  };
}
