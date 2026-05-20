export const springPresets = {
  pill: {
    type: "spring",
    stiffness: 450,
    damping: 28,
    mass: 0.6,
  },

  button: {
    type: "spring",
    stiffness: 400,
    damping: 25,
    mass: 0.5,
  },

  content: {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },

  micro: {
    type: "spring",
    stiffness: 600,
    damping: 20,
    mass: 0.3,
  },
} as const;
