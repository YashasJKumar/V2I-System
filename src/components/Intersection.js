import React from 'react';
import '../styles/Intersection.css';

const Intersection = ({ intersection }) => {
  const getSignalColor = (direction) => {
    const signal = intersection.signals[direction];
    if (!signal) return 'red';
    
    // Simple check - signal is now just 'GREEN' or 'RED'
    return signal === 'GREEN' ? 'green' : 'red';
  };

  const northColor = getSignalColor('north');
  const southColor = getSignalColor('south');
  const eastColor = getSignalColor('east');
  const westColor = getSignalColor('west');

  return (
    <div 
      className="intersection"
      style={{
        left: `${intersection.x - 60}px`,
        top: `${intersection.y - 60}px`
      }}
    >
      {/* Road markings */}
      <div className="road-horizontal"></div>
      <div className="road-vertical"></div>
      
      {/* Traffic signals - Standard two-phase system */}
      <div className="traffic-signal north">
        <div className={`signal-light ${northColor}`}></div>
      </div>
      <div className="traffic-signal south">
        <div className={`signal-light ${southColor}`}></div>
      </div>
      <div className="traffic-signal east">
        <div className={`signal-light ${eastColor}`}></div>
      </div>
      <div className="traffic-signal west">
        <div className={`signal-light ${westColor}`}></div>
      </div>

      {/* Emergency override indicator */}
      {intersection.emergencyOverride && (
        <div className="emergency-indicator">
          <span>🚨</span>
          <div className="emergency-turn-display">
            <div className="emergency-turn-label">
              Emergency Vehicle Approaching!!
            </div>
          </div>
        </div>
      )}

      {/* Intersection info */}
      <div className="intersection-info">
        ID: {intersection.id}
      </div>
    </div>
  );
};

export default Intersection;
