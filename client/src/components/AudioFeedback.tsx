import React, { useEffect, useRef } from 'react';
import { AudioState, INDIAN_SWARS } from '@/types';

interface AudioFeedbackProps {
  audioState: AudioState;
}

const AudioFeedback: React.FC<AudioFeedbackProps> = ({ audioState }) => {
  const audioVisualizerRef = useRef<HTMLDivElement>(null);

  // Create audio level bars for the visualizer
  useEffect(() => {
    if (audioVisualizerRef.current && audioVisualizerRef.current.children.length === 0) {
      for (let i = 0; i < 32; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-level-bar bg-primary-light';
        bar.style.height = '5px';
        audioVisualizerRef.current.appendChild(bar);
      }
    }
  }, []);

  // Update audio level bars when audioLevels change
  useEffect(() => {
    if (audioVisualizerRef.current && audioState.audioLevels.length > 0) {
      const bars = audioVisualizerRef.current.children;
      for (let i = 0; i < bars.length && i < audioState.audioLevels.length; i++) {
        (bars[i] as HTMLElement).style.height = `${audioState.audioLevels[i]}px`;
      }
    }
  }, [audioState.audioLevels]);

  return (
    <section id="audio-feedback" className={`mb-8 transition-opacity duration-300 ${audioState.isListening ? 'opacity-100' : 'opacity-50'}`}>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          {/* Audio Visualization */}
          <div className="flex-1">
            <h3 className="text-lg font-medium mb-3">Audio Input</h3>
            <div ref={audioVisualizerRef} className="audio-visualizer flex items-end justify-center bg-neutral-100 rounded-md p-2 h-[60px]">
              {/* Audio level bars will be added dynamically */}
            </div>
            <div className="text-center mt-2 text-sm">
              <span className="mr-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
              </span>
              <span id="frequency-value" className="font-mono">{Math.round(audioState.currentFrequency)} Hz</span>
            </div>
          </div>
          
          {/* Swar Display */}
          <div className="flex-1 flex flex-col items-center">
            <h3 className="text-lg font-medium mb-3">Current Swar</h3>
            <div 
              className={`swar-display w-32 h-32 rounded-full flex items-center justify-center 
                ${audioState.isNoteClean 
                  ? 'bg-status-success bg-opacity-10 border-4 border-status-success' 
                  : 'bg-status-error bg-opacity-5 border-4 border-status-error'}`}
              style={{ transition: 'all 0.3s ease' }}
            >
              <span 
                className={`font-display text-5xl font-bold 
                  ${audioState.isNoteClean ? 'text-status-success' : 'text-status-error'}`}
              >
                {audioState.currentSwar}
              </span>
            </div>
            <div className="flex items-center justify-center mt-4">
              <span className="text-sm mr-2">Saptak:</span>
              <span id="saptak-indicator" className="font-mono text-lg font-bold">
                {audioState.currentSaptak} ({audioState.currentOctave})
              </span>
            </div>
          </div>
          
          {/* Notes Scale */}
          <div className="flex-1">
            <h3 className="text-lg font-medium mb-3">Swar Scale</h3>
            <div className="grid grid-cols-7 gap-2">
              {INDIAN_SWARS.map((swar, index) => {
                const isActive = swar === audioState.currentSwar;
                const westernNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
                
                return (
                  <div 
                    key={swar}
                    data-swar={swar}
                    className={`swar-note ${isActive ? 'active' : 'inactive'} flex flex-col items-center p-2 rounded-md 
                      ${isActive
                        ? audioState.isNoteClean
                          ? 'bg-status-success bg-opacity-10'
                          : 'bg-status-error bg-opacity-10'
                        : 'bg-neutral-100'}`}
                    style={{ 
                      transition: 'transform 0.2s ease, opacity 0.2s ease',
                      transform: isActive ? 'scale(1.1)' : 'scale(0.95)',
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    <span 
                      className={`font-display font-bold text-lg 
                        ${isActive
                          ? audioState.isNoteClean
                            ? 'text-status-success'
                            : 'text-status-error'
                          : 'text-neutral-dark'}`}
                    >
                      {swar}
                    </span>
                    <span className="text-xs mt-1">{westernNotes[index]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AudioFeedback;
