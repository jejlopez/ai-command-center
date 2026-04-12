import React from 'react';
import { cn } from '../utils/cn';

export function ShimmerLoader({ className }) {
  return (
    <div className={cn('shimmer rounded-xl bg-white/[0.03]', className)} />
  );
}
