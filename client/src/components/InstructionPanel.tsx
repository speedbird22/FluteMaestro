import React from 'react';

const InstructionPanel: React.FC = () => {
  return (
    <section className="mb-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-medium mb-3">How to Use</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="h-6 w-6 rounded-full bg-primary-light flex items-center justify-center text-white text-sm mr-3">1</div>
            <p>Select your flute's scale from the dropdown menu above</p>
          </div>
          <div className="flex items-start">
            <div className="h-6 w-6 rounded-full bg-primary-light flex items-center justify-center text-white text-sm mr-3">2</div>
            <p>Click "Start Listening" to begin audio capture from your microphone</p>
          </div>
          <div className="flex items-start">
            <div className="h-6 w-6 rounded-full bg-primary-light flex items-center justify-center text-white text-sm mr-3">3</div>
            <p>Play your flute and observe the real-time swar detection</p>
          </div>
          <div className="flex items-start">
            <div className="h-6 w-6 rounded-full bg-primary-light flex items-center justify-center text-white text-sm mr-3">4</div>
            <p>Note color indicates clarity: <span className="text-green-500 font-medium">green</span> for clear notes, <span className="text-yellow-500 font-medium">yellow</span> for somewhat clear, and <span className="text-red-500 font-medium">red</span> for unclear notes</p>
          </div>
        </div>
        
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium mb-2">Understanding Saptak (Octaves)</h3>
          <p className="text-sm mb-2">In Hindustani classical music, notes are organized in three octave ranges:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li><span className="font-medium">Mandra Saptak</span> - Lower octave</li>
            <li><span className="font-medium">Madhya Saptak</span> - Middle octave (most common for beginning flutists)</li>
            <li><span className="font-medium">Taar Saptak</span> - Higher octave (requires more advanced technique)</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default InstructionPanel;
