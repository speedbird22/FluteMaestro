import { AudioState, SCALES, SWAR_MAPPING, WESTERN_NOTES } from '../types';

class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isProcessing: boolean = false;
  private updateCallback: (newState: Partial<AudioState>) => void;
  private bufferLength: number = 0;
  private dataArray: Float32Array = new Float32Array();
  private animationFrame: number | null = null;
  private currentState: AudioState;

  constructor(updateCallback: (newState: Partial<AudioState>) => void, initialState: AudioState) {
    this.updateCallback = updateCallback;
    this.currentState = initialState;
  }

  public async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.audioContext = new AudioContext();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser for pitch detection
      this.analyser.fftSize = 2048;
      this.bufferLength = this.analyser.fftSize;
      this.dataArray = new Float32Array(this.bufferLength);
      
      // Connect nodes
      this.microphone.connect(this.analyser);
      
      this.isProcessing = true;
      this.updateCallback({ isListening: true });
      
      // Start processing loop
      this.processAudio();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      this.updateCallback({ 
        isListening: false, 
        currentSwar: "Error",
        isNoteClean: false 
      });
    }
  }

  public stopProcessing(): void {
    if (!this.isProcessing) return;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.microphone = null;
    this.analyser = null;
    this.isProcessing = false;
    this.updateCallback({ isListening: false });
  }

  public updateScale(scale: string): void {
    this.currentState.selectedScale = scale;
  }

  private lastProcessingTime: number = 0;
  private processingInterval: number = 50; // 50ms = 0.05 seconds, further decreased resolution

  private processAudio = (): void => {
    if (!this.isProcessing || !this.analyser) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastProcessingTime;
    
    // Only process audio at fixed intervals (0.01 seconds = 10ms)
    if (elapsed >= this.processingInterval) {
      this.lastProcessingTime = now;
      
      // Get audio data
      this.analyser.getFloatTimeDomainData(this.dataArray);
      
      // Calculate audio levels for visualization
      const audioLevels = this.calculateAudioLevels();
      
      // Detect pitch
      const frequency = this.detectPitch();
      
      if (frequency > 0) {
        // Determine note, octave, saptak, and clarity
        const { note, octave, saptak, isClean, clarity } = this.analyzeFrequency(frequency);
        
        this.updateCallback({
          currentFrequency: frequency,
          currentSwar: note,
          currentOctave: octave,
          currentSaptak: saptak,
          isNoteClean: isClean,
          clarity: clarity,
          audioLevels
        });
      } else {
        // No clear frequency detected
        this.updateCallback({
          audioLevels,
          currentFrequency: 0,
        });
      }
    }
    
    this.animationFrame = requestAnimationFrame(this.processAudio);
  };

  private calculateAudioLevels(): number[] {
    const levels: number[] = [];
    const numBars = 32;
    const segmentLength = Math.floor(this.bufferLength / numBars);
    
    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      const startIndex = i * segmentLength;
      
      for (let j = 0; j < segmentLength; j++) {
        sum += Math.abs(this.dataArray[startIndex + j]);
      }
      
      const average = sum / segmentLength;
      
      // Scale for visualization (5-55px)
      const height = 5 + Math.min(50, Math.floor(average * 150));
      levels.push(height);
    }
    
    return levels;
  }

  private detectPitch(): number {
    // Implementation of autocorrelation algorithm for pitch detection
    const ac = this.autoCorrelate(this.dataArray, this.audioContext!.sampleRate);
    return ac;
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    // Find the root-mean-square of the signal
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    
    // Return if signal is too low (silence)
    if (rms < 0.015) return -1; // Threshold for silence detection
    
    // AMDF-based algorithm for clearer detection
    const maxFreq = 2400;
    const minFreq = 200;
    const maxPeriod = Math.floor(sampleRate / minFreq);
    const minPeriod = Math.floor(sampleRate / maxFreq);
    
    // Initialize arrays for the algorithm
    const amdf = new Float32Array(maxPeriod - minPeriod + 1);
    
    // The algorithm uses the average magnitude difference function
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let sum = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        sum += Math.abs(buffer[i] - buffer[i + period]);
      }
      amdf[period - minPeriod] = sum / (buffer.length - period);
    }
    
    // Find the valleys in the AMDF
    const valleys = [];
    for (let i = 1; i < amdf.length - 1; i++) {
      if (amdf[i] < amdf[i-1] && amdf[i] < amdf[i+1]) {
        valleys.push({
          index: i,
          value: amdf[i]
        });
      }
    }
    
    // Sort valleys by depth
    valleys.sort((a, b) => a.value - b.value);
    
    // No clear periodicity found
    if (valleys.length === 0) {
      return -1;
    }
    
    // The deepest valley corresponds to the fundamental frequency
    const period = valleys[0].index + minPeriod;
    
    // Convert period to frequency
    const frequency = sampleRate / period;
    
    // Specifically optimized for Hindustani flutes - common frequency ranges
    // We'll also apply a correction factor for typical bansuri inaccuracies
    const correctionFactor = 1.01; // Slight correction for bansuri tuning tendencies
    
    // Return the corrected frequency, filtered for the flute range
    const correctedFreq = frequency * correctionFactor;
    
    // Ensure we're in the Hindustani flute range - more specific range now
    if (correctedFreq < 220 || correctedFreq > 2200) {
      return -1;
    }
    
    return correctedFreq;
  }

  private analyzeFrequency(frequency: number): { note: string, octave: number, saptak: 'Mandra' | 'Madhya' | 'Taar', isClean: boolean, clarity: 'clear' | 'somewhat' | 'unclear' } {
    // Convert frequency to note information
    const { note, cents, octave } = this.frequencyToNote(frequency);
    
    // Convert western note to Indian swar based on selected scale
    const swar = this.westernToIndianSwar(note);
    
    // Note clarity levels - higher thresholds to better accommodate professionals:
    // 1. "clear" (green): cents deviation is small (< 25 cents)
    // 2. "somewhat" (yellow): cents deviation is moderate (25-45 cents)
    // 3. "unclear" (red): cents deviation is large (> 45 cents)
    let clarity: 'clear' | 'somewhat' | 'unclear' = 'unclear';
    const centsDev = Math.abs(cents);
    
    if (centsDev < 25) {
      clarity = 'clear';
    } else if (centsDev < 45) {
      clarity = 'somewhat';
    } else {
      clarity = 'unclear';
    }
    
    // For backward compatibility, also provide isClean
    const isClean = clarity === 'clear';
    
    // Determine the saptak (octave classification in Hindustani music)
    // In Hindustani classical music:
    // Mandra Saptak = lower octave (usually octave 3)
    // Madhya Saptak = middle octave (usually octave 4)
    // Taar Saptak = higher octave (usually octave 5)
    let saptak: 'Mandra' | 'Madhya' | 'Taar' = 'Madhya';
    
    if (octave <= 3) {
      saptak = 'Mandra';
    } else if (octave === 4) {
      saptak = 'Madhya';
    } else {
      saptak = 'Taar';
    }
    
    return {
      note: swar,
      octave,
      saptak,
      isClean,
      clarity
    };
  }

  private frequencyToNote(frequency: number): { note: string, cents: number, octave: number } {
    // Direct frequency to note conversion approach
    // Using standard equal temperament and A4 = 440Hz as reference
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    // Calculate how many half steps away from C0
    const exactHalfSteps = 12 * Math.log2(frequency / C0);
    const halfSteps = Math.round(exactHalfSteps);
    
    // Calculate octave and note index
    const octave = Math.floor(halfSteps / 12);
    const noteIndex = halfSteps % 12;
    
    // Calculate cents deviation
    const cents = Math.round((exactHalfSteps - halfSteps) * 100);
    
    // Ensure note index is within bounds
    let safeNoteIndex = noteIndex;
    if (safeNoteIndex < 0) safeNoteIndex = 0;
    if (safeNoteIndex >= WESTERN_NOTES.length) safeNoteIndex = WESTERN_NOTES.length - 1;
    
    const note = WESTERN_NOTES[safeNoteIndex];
    
    // Log the detected note for debugging
    console.log(`Frequency: ${frequency.toFixed(2)}Hz, Note: ${note}, Octave: ${octave}`);
    
    return {
      note,
      cents,
      octave
    };
  }
  
  // Cache for stable note detection to reduce fluttering between notes
  private lastNote: string = '';
  private lastOctave: number = 4;
  private lastNoteTimestamp: number = 0;
  private stableThreshold: number = 40; // increased cents threshold for note stability - better for professionals
  private stabilityDelay: number = 100; // increased ms to require before changing notes - more stable display
  
  private getStableNote(note: string, cents: number, octave: number): { note: string, cents: number, octave: number } {
    const now = Date.now();
    
    // If this is the first note detected or significant time has passed, just return this note
    if (!this.lastNote || now - this.lastNoteTimestamp > 300) {
      this.lastNote = note;
      this.lastOctave = octave;
      this.lastNoteTimestamp = now;
      return { note, cents, octave };
    }
    
    // Check if we need to stick with the previous note (for stability)
    if (now - this.lastNoteTimestamp < this.stabilityDelay) {
      return { note: this.lastNote, cents, octave: this.lastOctave };
    }
    
    // If the cents deviation is small enough, keep the same note
    if (Math.abs(cents) > this.stableThreshold) {
      // Significant deviation - update to new note
      this.lastNote = note;
      this.lastOctave = octave;
    }
    
    this.lastNoteTimestamp = now;
    return { note: this.lastNote, cents, octave: this.lastOctave };
  }

  // Cache for stable swar detection
  private lastSwar: string = 'Sa';
  private lastSwarTimestamp: number = 0;
  private swarStabilityDelay: number = 100; // Reduce the stability delay to allow changes between swars
  
  private westernToIndianSwar(westernNote: string): string {
    // Basic implementation that directly uses the western note mapping
    // with minimal processing to ensure we're getting different swars
    
    // Add null check for westernNote
    if (!westernNote || typeof westernNote !== 'string') {
      return 'Sa'; // Default to Sa if no valid note is detected
    }
    
    // Get the base note without sharp/flat for the western approach
    const baseNote = westernNote.charAt(0);
    
    // Adjust based on selected scale
    const scaleBase = this.currentState.selectedScale.charAt(0);
    const scaleOffset = WESTERN_NOTES.indexOf(scaleBase);
    
    if (scaleOffset === -1) {
      console.log("Invalid scale selected:", this.currentState.selectedScale);
      return 'Sa'; // Default to Sa if scale is invalid
    }
    
    // Get the index of the western note
    let noteIndex = WESTERN_NOTES.indexOf(baseNote);
    
    if (noteIndex === -1) {
      console.log("Invalid note detected:", westernNote);
      return 'Sa'; // Default to Sa if note is invalid
    }
    
    // Adjust for sharps
    if (westernNote.includes('#')) {
      noteIndex = (noteIndex + 1) % 12;
    }
    
    // Calculate the relative position based on the selected scale
    // (Where the selected scale is considered as 'Sa')
    const relativeIndex = (noteIndex - scaleOffset + 12) % 12;
    
    // Direct mapping to main swaras for simplicity and reliability
    // This ensures we're showing accurate swars for any input
    const simpleSwarMapping: Record<number, string> = {
      0: 'Sa',  // Sa
      2: 'Re',  // Re
      4: 'Ga',  // Ga
      5: 'Ma',  // Ma
      7: 'Pa',  // Pa
      9: 'Dha', // Dha
      11: 'Ni'  // Ni
    };
    
    // For non-exact swars, map to the closest main swar
    let closestSwar = 'Sa';
    let minDistance = 12;
    
    for (const [indexStr, swar] of Object.entries(simpleSwarMapping)) {
      const index = parseInt(indexStr);
      const distance = Math.min(
        Math.abs(relativeIndex - index),
        12 - Math.abs(relativeIndex - index)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestSwar = swar;
      }
    }
    
    // Very minimal stability to prevent rapid changes but still allow responsiveness
    const now = Date.now();
    if (now - this.lastSwarTimestamp < this.swarStabilityDelay && this.lastSwar) {
      return this.lastSwar;
    }
    
    // Update the timestamp and last swar
    this.lastSwarTimestamp = now;
    this.lastSwar = closestSwar;
    
    return closestSwar;
  }
}

export default AudioProcessor;
