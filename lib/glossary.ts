// One-line explanations for every technical term on the page: what it is, and how to read it.

export const GLOSSARY = {
  kp: "Kp index (0–9) measures how disturbed Earth's magnetic field is worldwide. The higher it is, the further south auroras reach — Oulu needs about 2 at dark spots and 4+ in town.",
  chance:
    "Our 0–100 score for seeing auroras, combining Kp, cloud cover and darkness. 60+ great, 35+ good, 15+ possible, below that unlikely.",
  spotKp:
    "The Kp a spot needs for a good chance. Dark sky (little light pollution) works from Kp 2, semi-dark shores from 3, city lights only from 4.",
  clouds: "Share of the sky covered by cloud. Auroras are ~100 km up, above all clouds — under 30% is good, over 70% usually hides them.",
  bz: "Bz is the north–south direction of the Sun's magnetic field arriving at Earth (in nT). Negative = south, which lets solar energy in; below −5 often means auroras within the hour.",
  solarWind: "The stream of particles from the Sun, in km/s. Around 400 is normal; above ~450 drives stronger, livelier auroras.",
  localK:
    "Local K-index (0–9): the same scale as Kp, but measured right next to Oulu by FMI magnetometers. It shows what is happening over Finland right now.",
  hRange:
    "How far the horizontal magnetic field swung in the last hour, in nanotesla (nT). Bigger swings mean auroral currents overhead — 100+ nT is very active.",
  nowcast: "Our estimate of activity over Oulu right now: the higher of the global Kp and the local K-index.",
  ovation:
    "NOAA's OVATION model: the % chance of aurora directly overhead in the next ~30–90 min. 'Within view' also counts auroras visible low on the northern horizon.",
  sunAlt: "How high the Sun is (negative = below the horizon). Below −12° the sky is dark enough for auroras; above −6° it is too bright.",
  outlook:
    "NOAA's 4-week forecast of the largest Kp per day, based on the Sun's 27-day rotation: active regions that faced Earth tend to come back. A hint, not a promise.",
  kpKind: "Observed = measured. Estimated = preliminary measurement. Predicted = NOAA's forecast.",
} as const;

export type TermKey = keyof typeof GLOSSARY;
