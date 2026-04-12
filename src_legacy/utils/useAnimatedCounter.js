import { useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function useAnimatedCounter(target, { decimals = 0, stiffness = 80, damping = 25 } = {}) {
  const spring = useSpring(0, { stiffness, damping, restDelta: 0.001 });
  const display = useTransform(spring, v => v.toFixed(decimals));
  useEffect(() => { spring.set(target); }, [target, spring]);
  return display; 
}
