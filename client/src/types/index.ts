export interface Note {
  name: string;
  frequency: number;
}

export interface Scale {
  name: string;
  baseFrequency: number;
}

export interface Swar {
  swar: string;
  western: string;
  isActive: boolean;
  isClean: boolean;
}

export interface AudioState {
  isListening: boolean;
  selectedScale: string;
  currentSwar: string;
  currentOctave: number;
  currentFrequency: number;
  isNoteClean: boolean;
  audioLevels: number[];
}

export const SCALES: Record<string, number> = {
  'C': 261.63,
  'C#': 277.18,
  'D': 293.66,
  'D#': 311.13,
  'E': 329.63,
  'F': 349.23,
  'F#': 369.99,
  'G': 392.00,
  'G#': 415.30,
  'A': 440.00,
  'A#': 466.16,
  'B': 493.88
};

export const SWAR_MAPPING: Record<string, string> = {
  'C': 'Sa',
  'D': 'Re',
  'E': 'Ga',
  'F': 'Ma',
  'G': 'Pa',
  'A': 'Dha',
  'B': 'Ni'
};

export const WESTERN_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const INDIAN_SWARS = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
