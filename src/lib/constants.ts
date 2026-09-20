/** Single source of phase labels (Spec 9.7). */

export const PHASE_LABELS = [
  {
    value: "Site Survey",
    full: "Site Survey",
    short: "Survey",
  },
  {
    value: "1st Fix Civil & Conduits",
    full: "1st Fix Civil & Conduits",
    short: "1st Fix",
  },
  {
    value: "2nd Fix Cable Pulling",
    full: "2nd Fix Cable Pulling",
    short: "2nd Fix",
  },
  {
    value: "3rd Fix Device Installation",
    full: "3rd Fix Device Installation",
    short: "3rd Fix Install",
  },
  {
    value: "3rd Fix Testing & Commissioning",
    full: "3rd Fix Testing & Commissioning",
    short: "3rd Fix T&C",
  },
  {
    value: "Official Handover",
    full: "Official Handover",
    short: "Handover",
  },
] as const;

export const PROJECT_STATUSES = [
  "Not Started Yet",
  "In Progress",
  "On Hold",
  "Delayed",
  "Completed",
] as const;

export const PROJECT_PRIORITIES = ["High", "Medium", "Low"] as const;

export const BLOCKER_SEVERITIES = ["Low", "Medium", "High"] as const;

export const SOLUTIONS = [
  "Parking System",
  "Access Control",
  "CCTV",
  "Fire Alarm",
  "Guidance System",
  "Gates Solutions",
  "Network",
] as const;

export const OFFLINE_WINDOW_MS = 72 * 60 * 60 * 1000;
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
