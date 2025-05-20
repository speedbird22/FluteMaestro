import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ControlPanel from '@/components/ControlPanel';
import AudioFeedback from '@/components/AudioFeedback';
import InstructionPanel from '@/components/InstructionPanel';
import Feedback from '@/components/Feedback';
import AudioProcessor from '@/lib/audioProcessor';
import { AudioState } from '@/types';
import { AlertCircle, Volume2, VolumeX } from 'lucide-react';

const Home: React.FC = () => {
  // Initialize audio state
  const [audioState, setAudioState] = useState<AudioState>({
    isListening: false,
    selectedScale: 'C',
    currentSwar: 'Sa',
    currentOctave: 4,
    currentSaptak: 'Madhya', // Default is middle octave (Madhya saptak)
    currentFrequency: 0,
    isNoteClean: true,
    clarity: 'clear', // Three-level clarity: clear, somewhat, unclear
    audioLevels: Array(32).fill(5) // Initialize with minimal height
  });

  // Create audio processor
  const [audioProcessor, setAudioProcessor] = useState<AudioProcessor | null>(null);
  
  // Track sound detection
  const [hasSound, setHasSound] = useState(false);
  const [showNoSoundAlert, setShowNoSoundAlert] = useState(false);
  const soundCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Practice statistics
  const [practiceStats, setPracticeStats] = useState({
    startTime: 0,
    totalDuration: 0,
    correctNotes: 0,
    totalNotes: 0
  });

  // Initialize audio processor
  useEffect(() => {
    const processor = new AudioProcessor(
      (newState) => {
        setAudioState(prevState => {
          // Update sound detection status
          if (newState.currentFrequency && newState.currentFrequency > 0) {
            setHasSound(true);
            // Reset the no sound alert timeout whenever sound is detected
            if (soundCheckTimeoutRef.current) {
              clearTimeout(soundCheckTimeoutRef.current);
              soundCheckTimeoutRef.current = null;
            }
            
            // Track correct notes for statistics
            if (prevState.clarity !== 'clear' && newState.clarity === 'clear') {
              setPracticeStats(stats => ({
                ...stats,
                correctNotes: stats.correctNotes + 1
              }));
            }
            
            // Count total notes only when changing to a new note
            if (prevState.currentSwar !== newState.currentSwar && newState.currentSwar) {
              setPracticeStats(stats => ({
                ...stats,
                totalNotes: stats.totalNotes + 1
              }));
            }
          }
          
          return { ...prevState, ...newState };
        });
      },
      audioState
    );
    setAudioProcessor(processor);

    // Clean up on unmount
    return () => {
      if (processor) {
        processor.stopProcessing();
      }
      
      if (soundCheckTimeoutRef.current) {
        clearTimeout(soundCheckTimeoutRef.current);
      }
    };
  }, []);

  // Start audio capture
  const startAudioCapture = async () => {
    if (audioProcessor) {
      await audioProcessor.startProcessing();
      
      // Reset practice stats
      setPracticeStats({
        startTime: Date.now(),
        totalDuration: 0,
        correctNotes: 0,
        totalNotes: 0
      });
      
      // Start checking for sound after a few seconds
      soundCheckTimeoutRef.current = setTimeout(() => {
        if (!hasSound) {
          setShowNoSoundAlert(true);
        }
      }, 3000);
    }
  };

  // Stop audio capture
  const stopAudioCapture = () => {
    if (audioProcessor) {
      audioProcessor.stopProcessing();
      
      // Update practice duration
      if (practiceStats.startTime > 0) {
        setPracticeStats(stats => ({
          ...stats,
          totalDuration: Math.floor((Date.now() - stats.startTime) / 1000)
        }));
      }
    }
    
    if (soundCheckTimeoutRef.current) {
      clearTimeout(soundCheckTimeoutRef.current);
      soundCheckTimeoutRef.current = null;
    }
    
    setHasSound(false);
    setShowNoSoundAlert(false);
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
        
        {/* Show alert if no sound is detected after starting */}
        {audioState.isListening && showNoSoundAlert && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            <p className="text-sm text-amber-700">
              No sound detected. Make sure your microphone is working and try playing your flute louder.
            </p>
          </div>
        )}
        
        {/* Audio status indicator */}
        {audioState.isListening && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center">
              {hasSound ? (
                <Volume2 className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <VolumeX className="h-5 w-5 text-gray-400 mr-2" />
              )}
              <span className="text-sm">
                {hasSound ? 'Sound detected' : 'Waiting for sound...'}
              </span>
            </div>
            
            {/* Practice statistics */}
            {practiceStats.startTime > 0 && (
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="font-medium">Time:</span>{' '}
                  {audioState.isListening 
                    ? Math.floor((Date.now() - practiceStats.startTime) / 1000)
                    : practiceStats.totalDuration}s
                </div>
                <div>
                  <span className="font-medium">Notes:</span>{' '}
                  {practiceStats.totalNotes}
                </div>
                <div>
                  <span className="font-medium">Accuracy:</span>{' '}
                  {practiceStats.totalNotes > 0 
                    ? Math.round((practiceStats.correctNotes / practiceStats.totalNotes) * 100)
                    : 0}%
                </div>
              </div>
            )}
          </div>
        )}
        
        <AudioFeedback audioState={audioState} />
        
        <InstructionPanel />
        
        <Feedback />
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
