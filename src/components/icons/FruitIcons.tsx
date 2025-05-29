"use client";

import type { SVGProps } from 'react';
import { Apple, Citrus, Grape, Leaf } from 'lucide-react';

// Re-exporting Lucide icons for consistency if used directly
export const AppleIcon = Apple;
export const GrapeIcon = Grape;
export const OrangeIcon = Citrus; // Using Citrus for Orange
export const LemonIcon = Citrus; // Using Citrus for Lemon
export const BananaIcon = (props: SVGProps<SVGSVGElement>) => (
  // Simple Banana placeholder
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 15s1-1 3-1 3 1 3 1S8 22 11 22s5-7 5-7-1-1-3-1-3 1-3 1"></path>
    <path d="M8.5 12.5s1.5-2 3.5-2 3.5 2 3.5 2"></path>
  </svg>
);
export const MangoIcon = (props: SVGProps<SVGSVGElement>) => (
  // Simple Mango placeholder, can reuse Apple or Leaf if needed
  <Leaf {...props} />
);

// Generic Fruit Icon
export const FruitIcon = Leaf;
