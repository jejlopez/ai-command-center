export const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const item = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)', scale: 0.97 },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  },
};
