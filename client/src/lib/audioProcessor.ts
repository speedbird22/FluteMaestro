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

  private processAudio = (): void => {
    if (!this.isProcessing || !this.analyser) {
      return;
    }

    // Get audio data
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Calculate audio levels for visualization
    const audioLevels = this.calculateAudioLevels();
    
    // Detect pitch
    const frequency = this.detectPitch();
    
    if (frequency > 0) {
      // Determine note, octave, saptak, and clarity
      const { note, octave, saptak, isClean } = this.analyzeFrequency(frequency);
      
      this.updateCallback({
        currentFrequency: frequency,
        currentSwar: note,
        currentOctave: octave,
        currentSaptak: saptak,
        isNoteClean: isClean,
        audioLevels
      });
    } else {
      // No clear frequency detected
      this.updateCallback({
        audioLevels,
        currentFrequency: 0,
      });
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
    if (rms < 0.015) return -1; // Slightly increase threshold for better silence detection
    
    // Improved YIN-like algorithm for pitch detection
    const bufferSize = buffer.length;
    const yinBuffer = new Float32Array(bufferSize / 2);
    
    // Step 1: Calculate difference function
    for (let tau = 0; tau < yinBuffer.length; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < yinBuffer.length; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }
    
    // Step 2: Cumulative mean normalized difference
    let runningSum = 0;
    yinBuffer[0] = 1;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }
    
    // Step 3: Find the first minimum below threshold
    const threshold = 0.15;
    let minTau = 0;
    let minVal = 1000; // arbitrary high value
    
    // Find the first local minimum in the normalized difference function
    for (let tau = 2; tau < yinBuffer.length; tau++) {
      if (yinBuffer[tau] < threshold) {
        if (yinBuffer[tau] < yinBuffer[tau - 1] && 
            yinBuffer[tau] < yinBuffer[tau + 1] && 
            yinBuffer[tau] < minVal) {
          minVal = yinBuffer[tau];
          minTau = tau;
          break; // Take the first good minimum we find
        }
      }
    }
    
    // If no minimum was found
    if (minTau === 0) {
      // Try again with a higher threshold
      for (let tau = 2; tau < yinBuffer.length; tau++) {
        if (yinBuffer[tau] < minVal) {
          minVal = yinBuffer[tau];
          minTau = tau;
        }
      }
      
      // Still nothing good found
      if (minTau === 0) {
        return -1;
      }
    }
    
    // Step 4: Parabolic interpolation
    let betterTau = minTau;
    if (minTau > 0 && minTau < yinBuffer.length - 1) {
      const s0 = yinBuffer[minTau - 1];
      const s1 = yinBuffer[minTau];
      const s2 = yinBuffer[minTau + 1];
      const adjustment = (s2 - s0) / (2 * (2 * s1 - s0 - s2));
      betterTau = minTau + adjustment;
    }
    
    // Convert tau to frequency
    const resultFreq = sampleRate / betterTau;
    
    // Filter out frequencies outside the typical flute range (200Hz to 2200Hz)
    if (resultFreq < 200 || resultFreq > 2200) {
      return -1;
    }
    
    return resultFreq;
  }

  private analyzeFrequency(frequency: number): { note: string, octave: number, saptak: 'Mandra' | 'Madhya' | 'Taar', isClean: boolean } {
    // Convert frequency to note information
    const { note, cents, octave } = this.frequencyToNote(frequency);
    
    // Convert western note to Indian swar based on selected scale
    const swar = this.westernToIndianSwar(note);
    
    // Note is "clean" if cents deviation is small
    const isClean = Math.abs(cents) < 30;  // Threshold for "clean" notes (±30 cents)
    
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
      isClean
    };
  }

  private frequencyToNote(frequency: number): { note: string, cents: number, octave: number } {
    // A4 is 440Hz, which is index 9 (A) in octave 4
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
    
    // Apply frequency bias correction for flute (tends to run slightly sharp)
    let correctedNoteIndex = noteIndex;
    
    // Handle potential index out of bounds
    if (correctedNoteIndex < 0) correctedNoteIndex = 0;
    if (correctedNoteIndex >= WESTERN_NOTES.length) correctedNoteIndex = WESTERN_NOTES.length - 1;
    
    // Apply stabilization - keep note consistent within a small cent range
    // to prevent rapid oscillation between adjacent notes
    const stableNote = this.getStableNote(WESTERN_NOTES[correctedNoteIndex], cents, octave);
    
    return {
      note: stableNote.note,
      cents: stableNote.cents,
      octave: stableNote.octave
    };
  }
  
  // Cache for stable note detection to reduce fluttering between notes
  private lastNote: string = '';
  private lastOctave: number = 4;
  private lastNoteTimestamp: number = 0;
  private stableThreshold: number = 30; // cents threshold for note stability
  private stabilityDelay: number = 50; // ms to require before changing notes
  
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
  
  private westernToIndianSwar(westernNote: string): string {
    // Add null check for westernNote
    if (!westernNote || typeof westernNote !== 'string') {
      return 'Sa'; // Default to Sa if no valid note is detected
    }
    
    const now = Date.now();
    
    // Get the base note without sharp/flat
    const baseNote = westernNote.charAt(0);
    
    // Adjust based on selected scale
    const scaleBase = this.currentState.selectedScale.charAt(0);
    const scaleOffset = WESTERN_NOTES.indexOf(scaleBase);
    
    if (scaleOffset === -1) {
      console.error("Invalid scale selected:", this.currentState.selectedScale);
      return this.lastSwar; // Return the last known swar if scale is invalid
    }
    
    // Get the index of the western note
    let noteIndex = WESTERN_NOTES.indexOf(baseNote);
    
    if (noteIndex === -1) {
      console.error("Invalid note detected:", westernNote);
      return this.lastSwar; // Return the last known swar if note is invalid
    }
    
    // Adjust for sharps
    if (westernNote.includes('#')) {
      noteIndex = (noteIndex + 1) % 12;
    }
    
    // Calculate the relative position based on the selected scale
    // (Where the selected scale is considered as 'Sa')
    const relativeIndex = (noteIndex - scaleOffset + 12) % 12;
    
    // Map to the corresponding Indian swar
    // More complete mapping including half-notes
    const swarMapping: Record<number, string> = {
      0: 'Sa',     // Scale base note = Sa
      1: 'Re♭',    // Komal Re
      2: 'Re',     // Shuddha Re
      3: 'Ga♭',    // Komal Ga
      4: 'Ga',     // Shuddha Ga
      5: 'Ma',     // Shuddha Ma
      6: 'Ma♯',    // Tivra Ma
      7: 'Pa',     // Shuddha Pa
      8: 'Dha♭',   // Komal Dha
      9: 'Dha',    // Shuddha Dha
      10: 'Ni♭',   // Komal Ni
      11: 'Ni'     // Shuddha Ni
    };
    
    // Get the Indian swar
    const currentSwar = swarMapping[relativeIndex] || 'Sa';
    
    // Implement stability - if changing too rapidly, keep previous swar
    if (now - this.lastSwarTimestamp < 150 && this.lastSwar) {
      return this.lastSwar;
    }
    
    // Update the cache for stability
    this.lastSwar = currentSwar;
    this.lastSwarTimestamp = now;
    
    return currentSwar;
  }
}

export default AudioProcessor;
