import React from 'react';

const Feedback: React.FC = () => {
  return (
    <section>
      <div className="bg-primary bg-opacity-5 border border-primary-light border-opacity-20 rounded-lg p-6">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-light mr-3 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <div>
            <h3 className="font-medium mb-1">Hindustani Flute Practice Tips</h3>
            <div className="space-y-2 text-sm">
              <p>For beginners: Focus on achieving consistent breath control. Yellow or green indicators show you're on the right path.</p>
              <p>For advanced players: The system is calibrated to identify professional-level intonation with green indicators. Yellow is still acceptable for many traditional performances.</p>
              <p>Start in <span className="font-medium">Madhya Saptak</span> (middle octave) to develop proper technique before exploring <span className="font-medium">Taar Saptak</span> (higher) or <span className="font-medium">Mandra Saptak</span> (lower).</p>
              <p>Practice the Sa-Re-Ga-Ma-Pa-Dha-Ni-Sa sequence in each saptak, gradually increasing speed while maintaining accuracy.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Feedback;
