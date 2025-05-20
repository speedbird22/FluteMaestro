import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Mic, Pause } from "lucide-react";
import { AudioState, SCALES } from '@/types';

interface ControlPanelProps {
  audioState: AudioState;
  startAudioCapture: () => void;
  stopAudioCapture: () => void;
  handleScaleChange: (value: string) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  audioState,
  startAudioCapture,
  stopAudioCapture,
  handleScaleChange,
}) => {
  return (
    <section className="mb-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-medium mb-4">Flute Settings</h2>
        
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <label htmlFor="scale-selector" className="block text-sm font-medium mb-2">Flute Scale</label>
            <Select 
              value={audioState.selectedScale} 
              onValueChange={handleScaleChange}
            >
              <SelectTrigger id="scale-selector" className="w-full px-4 py-3">
                <SelectValue placeholder="Select scale" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SCALES).map((scale) => (
                  <SelectItem key={scale} value={scale}>
                    {scale === 'C#' ? 'C# / Db' : 
                     scale === 'D#' ? 'D# / Eb' : 
                     scale === 'F#' ? 'F# / Gb' : 
                     scale === 'G#' ? 'G# / Ab' : 
                     scale === 'A#' ? 'A# / Bb' : 
                     scale} 
                     {scale === 'C' && ' (Middle)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Microphone Input</label>
            <div className="flex items-center space-x-4">
              <Button 
                id="start-btn" 
                onClick={startAudioCapture}
                disabled={audioState.isListening}
                className="flex items-center bg-[#00897B] hover:bg-[#00695C]"
              >
                <Mic className="h-4 w-4 mr-2" />
                <span>Start Listening</span>
              </Button>
              
              <Button 
                id="stop-btn" 
                onClick={stopAudioCapture}
                disabled={!audioState.isListening}
                variant="outline"
                className="flex items-center"
              >
                <Pause className="h-4 w-4 mr-2" />
                <span>Pause</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ControlPanel;
