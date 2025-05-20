// A simplified audio processor that focuses just on detecting different notes
class BasicAudioProcessor {
  constructor(updateCallback, initialState) {
    this.updateCallback = updateCallback;
    this.currentState = { ...initialState };
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.isProcessing = false;
    this.animationFrame = null;

    // For visualization
    this.bufferLength = 0;
    this.dataArray = new Float32Array();
    
    // For note stability
    this.lastNote = '';
    this.lastNoteTime = 0;
    this.stabilityDelay = 100; // ms
    
    // For swara mapping
    this.westernToSwar = {
      'C': 'Sa',
      'D': 'Re',
      'E': 'Ga',
      'F': 'Ma',
      'G': 'Pa',
      'A': 'Dha',
      'B': 'Ni'
    };
    
    // All western notes including sharps
    this.allWesternNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  }

  async startProcessing() {
    if (this.isProcessing) return;

    try {
      this.audioContext = new AudioContext();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyzer
      this.analyser.fftSize = 2048;
      this.bufferLength = this.analyser.fftSize;
      this.dataArray = new Float32Array(this.bufferLength);
      
      // Connect nodes
      this.microphone.connect(this.analyser);
      
      this.isProcessing = true;
      this.updateCallback({ isListening: true });
      
      // Begin processing audio
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

  stopProcessing() {
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

  updateScale(scale) {
    this.currentState.selectedScale = scale;
  }

  processAudio = () => {
    if (!this.isProcessing || !this.analyser) {
      return;
    }
    
    // Get data from analyzer
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Calculate audio levels for visualization
    const audioLevels = this.calculateAudioLevels();
    
    // Detect the pitch
    const frequency = this.detectPitch();
    
    if (frequency > 0) {
      // Calculate the closest musical note
      const { note, octave, cents } = this.getMusicalNote(frequency);
      
      // Determine note accuracy for visual feedback
      let clarity = 'unclear';
      if (Math.abs(cents) < 25) {
        clarity = 'clear'; 
      } else if (Math.abs(cents) < 45) {
        clarity = 'somewhat';
      }
      
      // Get the corresponding Indian swar based on selected scale
      const swar = this.getIndianSwar(note);
      
      // Determine saptak (Hindustani octave)
      let saptak = 'Madhya'; // Default to middle
      if (octave <= 3) {
        saptak = 'Mandra';
      } else if (octave >= 5) {
        saptak = 'Taar';
      }
      
      // Update the app state
      this.updateCallback({
        currentFrequency: Math.round(frequency),
        currentSwar: swar,
        currentOctave: octave, 
        currentSaptak: saptak,
        clarity: clarity,
        isNoteClean: clarity === 'clear',
        audioLevels
      });
    } else {
      // No clear pitch detected
      this.updateCallback({
        audioLevels,
        currentFrequency: 0
      });
    }
    
    this.animationFrame = requestAnimationFrame(this.processAudio);
  }

  // Convert audio signal to frequency using autocorrelation
  detectPitch() {
    const minFreq = 220; 
    const maxFreq = 2000;
    
    // Check if signal is too weak
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      sum += Math.abs(this.dataArray[i]);
    }
    const signalAverage = sum / this.bufferLength;
    if (signalAverage < 0.01) return -1;
    
    // Use autocorrelation for pitch detection
    let ac = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
    
    // Check if frequency is in the expected range for flutes
    if (ac > minFreq && ac < maxFreq) {
      return ac;
    }
    
    return -1;
  }
  
  // Implementation of autocorrelation algorithm
  autoCorrelate(buffer, sampleRate) {
    // Calculate root-mean-square to see if there's enough signal
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    
    // Not enough signal
    if (rms < 0.01) return -1;
    
    let r1 = 0, r2 = buffer.length - 1;
    let threshold = 0.2;
    
    // Find the first point where signal crosses threshold
    for (let i = 0; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[i]) < threshold) {
        r1 = i;
        break;
      }
    }
    
    for (let i = 1; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[buffer.length - i]) < threshold) {
        r2 = buffer.length - i;
        break;
      }
    }
    
    // Get the actual buffer we're going to use for correlation
    buffer = buffer.slice(r1, r2);
    const correlations = new Array(buffer.length).fill(0);
    
    // Compute correlations
    for (let i = 0; i < buffer.length; i++) {
      for (let j = 0; j < buffer.length - i; j++) {
        correlations[i] += buffer[j] * buffer[j + i];
      }
    }
    
    // Find the first peak in correlation
    let foundPeak = false;
    let maxCorrelation = 0;
    let maxIndex = 0;
    
    // Start from a reasonable offset to avoid detecting at very low periods
    let minOffset = Math.floor(sampleRate / 2000); // ~= 20 samples at 44.1kHz
    
    for (let i = minOffset; i < correlations.length; i++) {
      if (correlations[i] > maxCorrelation) {
        maxCorrelation = correlations[i];
        maxIndex = i;
        foundPeak = true;
      } else if (foundPeak) {
        // We've found our first peak and correlation is now decreasing
        break;
      }
    }
    
    // Convert correlation peak to frequency
    if (foundPeak) {
      let frequency = sampleRate / maxIndex;
      return frequency;
    }
    
    return -1;
  }

  // Convert frequency to a Western musical note
  getMusicalNote(frequency) {
    // Using A4 = 440Hz as reference
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    // Calculate how many half steps away from C0
    const halfStepsFromC0 = 12 * Math.log2(frequency / C0);
    
    // Get the nearest note
    const roundedHalfSteps = Math.round(halfStepsFromC0);
    
    // Calculate cents deviation
    const cents = (halfStepsFromC0 - roundedHalfSteps) * 100;
    
    // Calculate octave
    const octave = Math.floor(roundedHalfSteps / 12);
    
    // Calculate note index (0 = C, 1 = C#, etc.)
    const noteIndex = roundedHalfSteps % 12;
    
    // Get the note name
    const note = this.allWesternNotes[noteIndex];
    
    return { note, octave, cents };
  }

  // Convert Western note to Indian swar based on selected scale
  getIndianSwar(westernNote) {
    // Apply stability to prevent rapid changes
    const now = Date.now();
    if (now - this.lastNoteTime < this.stabilityDelay && this.lastNote) {
      return this.lastNote;
    }
    
    // Take just the base note (without sharp/flat)
    const baseNote = westernNote.charAt(0);
    
    // Get the selected scale
    const scale = this.currentState.selectedScale;
    const scaleBase = scale.charAt(0);
    
    // Calculate offset between C and the selected scale
    const cIndex = this.allWesternNotes.indexOf('C');
    const scaleIndex = this.allWesternNotes.indexOf(scaleBase);
    const offset = (scaleIndex - cIndex + 12) % 12;
    
    // Get the index of the detected note
    const noteIndex = this.allWesternNotes.indexOf(baseNote);
    if (noteIndex === -1) return 'Sa'; // Safety check
    
    // Calculate the note's position relative to the scale
    const relativePosition = (noteIndex - scaleIndex + 12) % 12;
    
    // Map to the corresponding swar
    // Main swar positions: 0=Sa, 2=Re, 4=Ga, 5=Ma, 7=Pa, 9=Dha, 11=Ni
    const swarIndices = [0, 2, 4, 5, 7, 9, 11];
    const swarNames = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
    
    // Find closest swar
    let closestDistance = 12;
    let closestSwar = 'Sa';
    
    for (let i = 0; i < swarIndices.length; i++) {
      const distance = Math.min(
        Math.abs(relativePosition - swarIndices[i]),
        12 - Math.abs(relativePosition - swarIndices[i])
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSwar = swarNames[i];
      }
    }
    
    // Update last note for stability
    this.lastNote = closestSwar;
    this.lastNoteTime = now;
    
    return closestSwar;
  }

  // Calculate audio levels for visualization
  calculateAudioLevels() {
    const levels = [];
    const numBars = 32;
    const segmentLength = Math.floor(this.bufferLength / numBars);
    
    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      const startIndex = i * segmentLength;
      
      for (let j = 0; j < segmentLength; j++) {
        sum += Math.abs(this.dataArray[startIndex + j] || 0);
      }
      
      const average = sum / segmentLength;
      
      // Scale for visualization (5-55px)
      const height = 5 + Math.min(50, Math.floor(average * 150));
      levels.push(height);
    }
    
    return levels;
  }
}

export default BasicAudioProcessor;