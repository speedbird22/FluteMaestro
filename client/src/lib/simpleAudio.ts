import { AudioState, WESTERN_NOTES, SCALES } from '@/types';

// This is a simplified audio processor that focuses on accurate swar detection
class SimpleAudioProcessor {
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
  private lastProcessTime: number = 0;
  private processInterval: number = 50; // 50ms interval
  
  // For swar stability
  private lastSwar: string = 'Sa';
  private lastNoteTime: number = 0;
  private stabilityThreshold: number = 100; // ms
  
  // Swar mapping from Western notes to Indian swars
  private swarMap: Record<string, string> = {
    'C': 'Sa',
    'D': 'Re',
    'E': 'Ga',
    'F': 'Ma',
    'G': 'Pa',
    'A': 'Dha',
    'B': 'Ni'
  };

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
      
      // Configure analyser
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
        isNoteClean: false,
        clarity: 'unclear'
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
    
    const now = Date.now();
    if (now - this.lastProcessTime >= this.processInterval) {
      this.lastProcessTime = now;
      
      // Get audio data
      this.analyser.getFloatTimeDomainData(this.dataArray);
      
      // Calculate audio levels
      const audioLevels = this.calculateAudioLevels();
      
      // Get the dominant frequency
      const frequency = this.findDominantFrequency();
      
      if (frequency > 0) {
        // Convert to music note
        const { note, octave, clarity } = this.getMusicalNote(frequency);
        
        // Convert Western note to Indian swar
        const swar = this.getIndianSwar(note);
        
        // Determine the saptak
        let saptak: 'Mandra' | 'Madhya' | 'Taar' = 'Madhya';
        if (octave <= 3) {
          saptak = 'Mandra';
        } else if (octave === 4) {
          saptak = 'Madhya';
        } else {
          saptak = 'Taar';
        }
        
        this.updateCallback({
          currentFrequency: frequency,
          currentSwar: swar,
          currentOctave: octave,
          currentSaptak: saptak,
          isNoteClean: clarity === 'clear',
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

  private findDominantFrequency(): number {
    // Simple implementation to get the dominant frequency from audio data
    // Check if signal is strong enough
    let rms = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      rms += this.dataArray[i] * this.dataArray[i];
    }
    rms = Math.sqrt(rms / this.bufferLength);
    
    // Return if signal is too weak
    if (rms < 0.01) return -1;
    
    // Use autocorrelation to find pitch
    const minFreq = 220; // Lower limit for detection (typical for flutes)
    const maxFreq = 2000; // Upper limit for detection
    const maxPeriod = Math.floor(this.audioContext!.sampleRate / minFreq);
    const minPeriod = Math.floor(this.audioContext!.sampleRate / maxFreq);
    
    let bestPeriod = 0;
    let bestCorrelation = 0;
    
    // Simple autocorrelation
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      
      for (let i = 0; i < this.bufferLength - period; i++) {
        correlation += this.dataArray[i] * this.dataArray[i + period];
      }
      
      correlation = correlation / (this.bufferLength - period);
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    // Only return a frequency if the correlation is strong enough
    if (bestCorrelation > 0.01) {
      return this.audioContext!.sampleRate / bestPeriod;
    }
    
    return -1;
  }

  private getMusicalNote(frequency: number): { note: string, octave: number, clarity: 'clear' | 'somewhat' | 'unclear' } {
    // Convert frequency to musical note using equal temperament
    const A4 = 440; // A4 = 440Hz in standard tuning
    
    // Calculate the number of half steps away from A4
    const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
    
    // Calculate the exact number of half steps for cents calculation
    const exactHalfSteps = 12 * Math.log2(frequency / A4);
    
    // Calculate cents deviation from the nearest note
    const cents = Math.abs((exactHalfSteps - halfStepsFromA4) * 100);
    
    // Calculate the octave
    const octave = Math.floor((halfStepsFromA4 + 9 + 12 * 4) / 12);
    
    // Calculate the note index (0 = C, 1 = C#, etc.)
    let noteIndex = (halfStepsFromA4 + 9) % 12;
    if (noteIndex < 0) noteIndex = noteIndex + 12;
    
    // Get the note name
    const note = WESTERN_NOTES[noteIndex];
    
    // Determine clarity based on cents deviation
    let clarity: 'clear' | 'somewhat' | 'unclear';
    if (cents < 25) {
      clarity = 'clear';
    } else if (cents < 45) {
      clarity = 'somewhat';
    } else {
      clarity = 'unclear';
    }
    
    return { note, octave, clarity };
  }

  private getIndianSwar(westernNote: string): string {
    const now = Date.now();
    let swar;
    
    // Get the base note (remove any sharp or flat)
    const baseNote = westernNote.charAt(0);
    
    // Get the selected scale
    const selectedScale = this.currentState.selectedScale;
    const scaleBase = selectedScale.charAt(0);
    
    // Map from C-based to scale-based
    const cIndex = WESTERN_NOTES.indexOf('C');
    const scaleIndex = WESTERN_NOTES.indexOf(scaleBase);
    const offset = (scaleIndex - cIndex + 12) % 12;
    
    // Map western note to Indian swar based on selected scale
    // For scale C: C=Sa, D=Re, E=Ga, etc.
    // For scale G: G=Sa, A=Re, B=Ga, etc.
    const westernIndex = WESTERN_NOTES.indexOf(baseNote);
    const relativeIndex = (westernIndex - scaleIndex + 12) % 12;
    
    // Map to primary swars only
    const swarIndices = [0, 2, 4, 5, 7, 9, 11]; // Sa, Re, Ga, Ma, Pa, Dha, Ni
    const primarySwars = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
    
    // Find the closest primary swar
    let closestDistance = 12;
    let closestSwar = 'Sa';
    
    for (let i = 0; i < swarIndices.length; i++) {
      const distance = Math.min(
        Math.abs(relativeIndex - swarIndices[i]),
        12 - Math.abs(relativeIndex - swarIndices[i])
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSwar = primarySwars[i];
      }
    }
    
    swar = closestSwar;
    
    // Apply stability to prevent rapid changes
    if (now - this.lastNoteTime < this.stabilityThreshold && this.lastSwar) {
      return this.lastSwar;
    }
    
    this.lastSwar = swar;
    this.lastNoteTime = now;
    
    return swar;
  }
}

export default SimpleAudioProcessor;