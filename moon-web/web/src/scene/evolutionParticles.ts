/** Normalized cut-face paths for explanatory animation, not a physical solver. */
export function evolutionParticle(stage: number, index: number, time: number) {
  const phase = (time / 7 + (index % 36) / 36) % 1;
  if (stage === 0) {
    const angle = phase * Math.PI * 2;
    const radius = 0.8 + 0.08 * Math.cos(angle);
    const latitude =
      (Math.floor(index / 36) - 1) * 0.55 + 0.16 * Math.sin(angle);
    return {
      y: radius * Math.cos(latitude),
      z: radius * Math.sin(latitude),
      alpha: 0.15 + 0.85 * (1 - (index % 36) / 36),
      size: index % 36 === 0 ? 6 : 3,
      rising: false,
    };
  }
  if (stage === 1) {
    const rising = index < 54;
    const r = rising ? 0.5 + phase * 0.45 : 0.87 - phase * 0.43;
    const angle = -1.05 + ((index % 18) / 17) * 2.1;
    return {
      y: r * Math.cos(angle),
      z: r * Math.sin(angle),
      alpha: Math.sin(phase * Math.PI),
      size: rising ? 5 : 4,
      rising,
    };
  }
  // A local impact repeats every 12 demonstration seconds, followed by a fading ring.
  const cycle = time % 12;
  if (index < 12) {
    const travel = Math.min(cycle / 2.5, 1) - index * 0.014;
    return {
      y: 0.55 + travel * 0.15,
      z: 1.55 - travel * 0.84,
      alpha: cycle < 2.5 ? 1 - index / 12 : 0,
      size: index === 0 ? 9 : 4,
      rising: false,
    };
  }
  const age = Math.max(0, cycle - 2.5);
  const angle = ((index - 12) / 96) * Math.PI * 2;
  const radius = age * 0.035;
  return {
    y: 0.7 + Math.cos(angle) * radius,
    z: 0.71 + Math.sin(angle) * radius,
    alpha: cycle > 2.5 ? Math.max(0, 1 - age / 5) : 0,
    size: 3,
    rising: false,
  };
}
