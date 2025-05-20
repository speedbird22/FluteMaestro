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
            <h3 className="font-medium mb-1">Practice Tip</h3>
            <p className="text-sm">Focus on achieving a stable green indicator for each note before moving to the next. Try to maintain consistent breath control for clearer notes.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Feedback;
