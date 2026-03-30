import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React from 'react';

interface QuizantLogoProps extends React.SVGProps<SVGSVGElement> {
    animated?: boolean;
    loop?: boolean;
}

export const QuizantLogo = React.forwardRef<SVGSVGElement, QuizantLogoProps>(
    ({ className, animated = false, loop = false, ...props }, ref) => {
        // Animation variants for sequential drawing
        const draw = {
            hidden: { pathLength: 0, opacity: 0 },
            visible: (i: number) => {
                const delay = i * 0.4;
                return {
                    pathLength: 1,
                    opacity: 1,
                    transition: {
                        pathLength: { delay, type: "spring", duration: 1.2, bounce: 0 },
                        opacity: { delay, duration: 0.01 },
                        ...(loop && {
                            repeat: Infinity,
                            repeatType: "reverse",
                            repeatDelay: 2
                        } as any)
                    }
                };
            }
        };

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                className={cn("text-primary", className)}
                fill="none"
                stroke="currentColor"
                ref={ref}
                {...props}
            >
                {animated ? (
                    <>
                        {/* The Circle */}
                        <motion.circle
                            cx="14" cy="14" r="10"
                            strokeWidth="3"
                            custom={0}
                            variants={draw}
                            initial="hidden"
                            animate="visible"
                        />
                        {/* The Tail (growing out) */}
                        <motion.line
                            x1="21" y1="21" x2="30" y2="12"
                            strokeWidth="3" strokeLinecap="round"
                            custom={1}
                            variants={draw}
                            initial="hidden"
                            animate="visible"
                        />
                        {/* The Arrow Head */}
                        <motion.polyline
                            points="26,12 30,12 30,16"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            custom={2}
                            variants={draw}
                            initial="hidden"
                            animate="visible"
                        />
                    </>
                ) : (
                    <>
                        <circle cx="14" cy="14" r="10" strokeWidth="3" />
                        <line x1="21" y1="21" x2="30" y2="12" strokeWidth="3" strokeLinecap="round" />
                        <polyline points="26,12 30,12 30,16" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                )}
            </svg>
        );
    }
);

QuizantLogo.displayName = 'QuizantLogo';
