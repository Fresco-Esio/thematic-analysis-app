/**
 * motionConfig.js
 * Shared animation constants for Framer Motion.
 *
 * Springs: used for spatial movement (scale, position).
 *   - entrance: slower settle, more organic for first appearance
 *   - hover: snappier response for interactive feedback
 *
 * Easings: used for opacity and presence transitions.
 *   standard is cubic-bezier(0.4, 0, 0.2, 1) — symmetric ease-in-out
 *   giving natural acceleration and deceleration.
 */

export const springs = {
  entrance: { type: 'spring', stiffness: 220, damping: 22 },
  hover:    { type: 'spring', stiffness: 380, damping: 28 },
};

export const easings = {
  standard: [0.4, 0, 0.2, 1],
};

/** Tooltip presence animation variants — used with AnimatePresence */
export const tooltipVariants = {
  hidden: {
    opacity: 0,
    y: 6,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};
