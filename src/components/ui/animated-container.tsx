"use client";

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type AnimationVariant = 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'bounce' | 'rotate';

type AnimatedContainerProps = {
  children: React.ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  className?: string;
} & Omit<HTMLMotionProps<"div">, 'initial' | 'animate' | 'variants' | 'transition'>;

// Define animation variants
const variants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  },
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  },
  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 }
  },
  slideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 }
  },
  slideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  },
  bounce: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.5
      }
    }
  },
  rotate: {
    hidden: { opacity: 0, rotate: -5 },
    visible: { opacity: 1, rotate: 0 }
  }
};

export default function AnimatedContainer({
  children,
  variant = 'fadeIn',
  delay = 0,
  duration = 0.5,
  className,
  ...props
}: AnimatedContainerProps) {
  return (
    <motion.div
      variants={variants[variant]}
      initial="hidden"
      animate="visible"
      transition={{
        duration,
        delay,
        ease: 'easeOut'
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
