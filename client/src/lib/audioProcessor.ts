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
      // Determine note, octave, and clarity
      const { note, octave, isClean } = this.analyzeFrequency(frequency);
      
      this.updateCallback({
        currentFrequency: frequency,
        currentSwar: note,
        currentOctave: octave,
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
    if (rms < 0.01) return -1;
    
    // Find autocorrelation
    let r1 = 0, r2 = buffer.length - 1;
    const thres = 0.2;
    
    for (let i = 0; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[i]) < thres) {
        r1 = i;
        break;
      }
    }
    
    for (let i = 1; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[buffer.length - i]) < thres) {
        r2 = buffer.length - i;
        break;
      }
    }
    
    const buf1 = buffer.slice(r1, r2);
    const correlations = new Array(buf1.length).fill(0);
    
    // Calculate autocorrelation
    for (let i = 0; i < buf1.length; i++) {
      for (let j = 0; j < buf1.length - i; j++) {
        correlations[i] += buf1[j] * buf1[j + i];
      }
    }
    
    // Find the peak
    let peak = 0;
    for (let i = 1; i < correlations.length; i++) {
      if (correlations[i] > correlations[peak]) {
        peak = i;
      }
    }
    
    // Refine the peak by interpolating between the three highest points
    let peakValue = correlations[peak];
    let leftValue = correlations[peak - 1] || 0;
    let rightValue = correlations[peak + 1] || 0;
    
    let shift = 0;
    if (peak > 0 && peak < correlations.length - 1) {
      shift = (rightValue - leftValue) / (2 * (2 * peakValue - leftValue - rightValue));
    }
    
    return sampleRate / (peak + shift);
  }

  private analyzeFrequency(frequency: number): { note: string, octave: number, isClean: boolean } {
    // Convert frequency to note information
    const { note, cents, octave } = this.frequencyToNote(frequency);
    
    // Convert western note to Indian swar based on selected scale
    const swar = this.westernToIndianSwar(note);
    
    // Note is "clean" if cents deviation is small
    const isClean = Math.abs(cents) < 30;  // Threshold for "clean" notes (±30 cents)
    
    return {
      note: swar,
      octave,
      isClean
    };
  }

  private frequencyToNote(frequency: number): { note: string, cents: number, octave: number } {
    // A4 is 440Hz, which is index 9 (A) in octave 4
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    // Calculate how many half steps away from C0
    const halfSteps = Math.round(12 * Math.log2(frequency / C0));
    
    // Calculate octave and note index
    const octave = Math.floor(halfSteps / 12);
    const noteIndex = halfSteps % 12;
    
    // Calculate cents deviation
    const exactHalfSteps = 12 * Math.log2(frequency / C0);
    const cents = Math.round((exactHalfSteps - halfSteps) * 100);
    
    return {
      note: WESTERN_NOTES[noteIndex],
      cents,
      octave
    };
  }

  private westernToIndianSwar(westernNote: string): string {
    // Get the base note without sharp/flat
    const baseNote = westernNote.charAt(0);
    
    // Adjust based on selected scale
    const scaleOffset = WESTERN_NOTES.indexOf(this.currentState.selectedScale.charAt(0));
    
    // Get the index of the western note
    let noteIndex = WESTERN_NOTES.indexOf(baseNote);
    
    // Adjust for sharps
    if (westernNote.includes('#')) {
      noteIndex = (noteIndex + 1) % 12;
    }
    
    // Calculate the relative position based on the selected scale
    // (Where the selected scale is considered as 'Sa')
    const relativeIndex = (noteIndex - scaleOffset + 12) % 12;
    
    // Map to the corresponding Indian swar
    // In Indian classical, Sa is fixed and other notes are relative
    // With C as reference: C=Sa, D=Re, E=Ga, F=Ma, G=Pa, A=Dha, B=Ni
    const swarMapping = {
      0: 'Sa',  // Scale base note = Sa
      2: 'Re',  // 2 semitones from Sa = Re
      4: 'Ga',  // 4 semitones from Sa = Ga
      5: 'Ma',  // 5 semitones from Sa = Ma
      7: 'Pa',  // 7 semitones from Sa = Pa
      9: 'Dha', // 9 semitones from Sa = Dha
      11: 'Ni', // 11 semitones from Sa = Ni
    } as Record<number, string>;
    
    // If the relativeIndex isn't exactly on a swar, return the closest one
    // For simplicity, we'll return the lower swar and mark it as "not clean"
    const closestSwar = Object.entries(swarMapping)
      .reduce((closest, [index, swar]) => {
        const currentDiff = Math.abs(Number(index) - relativeIndex);
        const closestDiff = Math.abs(Number(closest[0]) - relativeIndex);
        return currentDiff < closestDiff ? [index, swar] : closest;
      }, ['0', 'Sa']);
    
    return closestSwar[1];
  }
}

export default AudioProcessor;
