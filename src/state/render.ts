// Lets non-React code (interaction, overlay) ask for a frame and hear about camera changes.
// The scene installs the real invalidate() when it mounts; frames are only drawn on demand.
export const render = {
  invalidate: () => {},
  /** Called once per rendered frame, after the camera is placed. */
  onFrame: new Set<() => void>(),
};
