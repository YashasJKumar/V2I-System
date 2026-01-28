import React from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import '../styles/Intersection.css';

const Intersection = ({ intersection }) => {
  const { SIGNAL_PHASES } = useSimulation();

  const getSignalColor = (direction) => {
    const { phase } = intersection;
    
    if (direction === 'NS') {
      if (phase === SIGNAL_PHASES.NORTH_SOUTH_GREEN) return 'green';
      if (phase === SIGNAL_PHASES.NORTH_SOUTH_YELLOW) return 'yellow';
      return 'red';
    } else {
      if (phase === SIGNAL_PHASES.EAST_WEST_GREEN) return 'green';
      if (phase === SIGNAL_PHASES.EAST_WEST_YELLOW) return 'yellow';
      return 'red';
    }
  };

  const nsColor = getSignalColor('NS');
  const ewColor = getSignalColor('EW');

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
      
      {/* Traffic signals */}
      <div className="traffic-signal north">
        <div className={`signal-light ${nsColor}`}></div>
      </div>
      <div className="traffic-signal south">
        <div className={`signal-light ${nsColor}`}></div>
      </div>
      <div className="traffic-signal east">
        <div className={`signal-light ${ewColor}`}></div>
      </div>
      <div className="traffic-signal west">
        <div className={`signal-light ${ewColor}`}></div>
      </div>

      {/* Emergency override indicator */}
      {intersection.emergencyOverride && (
        <div className="emergency-indicator">
          <span>🚨</span>
          {intersection.emergencyTurnDirection && (
            <div className="emergency-turn-indicator">
              EMERGENCY TURNING {intersection.emergencyTurnDirection.toUpperCase()}
            </div>
          )}
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
