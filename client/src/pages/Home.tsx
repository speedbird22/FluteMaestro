import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ControlPanel from '@/components/ControlPanel';
import AudioFeedback from '@/components/AudioFeedback';
import InstructionPanel from '@/components/InstructionPanel';
import Feedback from '@/components/Feedback';
import AudioProcessor from '@/lib/audioProcessor';
import { AudioState } from '@/types';

const Home: React.FC = () => {
  // Initialize audio state
  const [audioState, setAudioState] = useState<AudioState>({
    isListening: false,
    selectedScale: 'C',
    currentSwar: 'Sa',
    currentOctave: 4,
    currentFrequency: 0,
    isNoteClean: true,
    audioLevels: Array(32).fill(5) // Initialize with minimal height
  });

  // Create audio processor
  const [audioProcessor, setAudioProcessor] = useState<AudioProcessor | null>(null);

  // Initialize audio processor
  useEffect(() => {
    const processor = new AudioProcessor(
      (newState) => setAudioState(prevState => ({ ...prevState, ...newState })),
      audioState
    );
    setAudioProcessor(processor);

    // Clean up on unmount
    return () => {
      if (processor) {
        processor.stopProcessing();
      }
    };
  }, []);

  // Start audio capture
  const startAudioCapture = async () => {
    if (audioProcessor) {
      await audioProcessor.startProcessing();
    }
  };

  // Stop audio capture
  const stopAudioCapture = () => {
    if (audioProcessor) {
      audioProcessor.stopProcessing();
    }
  };

  // Handle scale change
  const handleScaleChange = (scale: string) => {
    setAudioState(prevState => ({ ...prevState, selectedScale: scale }));
    if (audioProcessor) {
      audioProcessor.updateScale(scale);
    }
  };

  return (
    <div className="bg-neutral-light min-h-screen font-sans text-neutral-dark">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <ControlPanel 
          audioState={audioState}
          startAudioCapture={startAudioCapture}
          stopAudioCapture={stopAudioCapture}
          handleScaleChange={handleScaleChange}
        />
        
        <AudioFeedback audioState={audioState} />
        
        <InstructionPanel />
        
        <Feedback />
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
