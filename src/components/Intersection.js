import React from 'react';
import '../styles/Intersection.css';

const Intersection = ({ intersection }) => {
  const getSignalColor = (direction) => {
    const signal = intersection.signals[direction];
    if (!signal) return 'red';
    
    if (signal.phase.includes('GREEN')) return 'green';
    if (signal.phase.includes('YELLOW')) return 'yellow';
    return 'red';
  };

  // Get timer display
  const getTimerDisplay = () => {
    if (intersection.emergencyMode || intersection.emergencyOverride) {
      return {
        text: 'EMERGENCY',
        color: '#ff0000',
        flashing: true
      };
    }

    // Find active signal (green or yellow)
    let activeDirection = null;
    let activeTimer = 0;
    ['north', 'south', 'east', 'west'].forEach(dir => {
      const signal = intersection.signals[dir];
      if (signal && (signal.phase.includes('GREEN') || signal.phase.includes('YELLOW'))) {
        activeDirection = dir;
        activeTimer = signal.timer;
      }
    });

    if (activeDirection && activeTimer > 0) {
      const seconds = Math.ceil(activeTimer / 1000);
      const color = seconds <= 3 ? '#ff0000' : 
                   seconds <= 10 ? '#ffaa00' : '#00ff00';
      return {
        text: `${seconds}s`,
        color: color,
        flashing: false
      };
    }

    return {
      text: '0s',
      color: '#ff0000',
      flashing: false
    };
  };

  const northColor = getSignalColor('north');
  const southColor = getSignalColor('south');
  const eastColor = getSignalColor('east');
  const westColor = getSignalColor('west');
  const timerDisplay = getTimerDisplay();

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
      
      {/* Traffic signals - Indian style independent control */}
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

      {/* Timer Display */}
      <div 
        className={`intersection-timer ${timerDisplay.flashing ? 'flashing' : ''}`}
        style={{ color: timerDisplay.color }}
      >
        {timerDisplay.text}
      </div>

      {/* Emergency override indicator */}
      {intersection.emergencyOverride && (
        <div className="emergency-indicator">
          <span>🚨</span>
          {intersection.emergencyTurnDirection && (
            <div className="emergency-turn-display">
              <div className="emergency-turn-label">
                {intersection.emergencyTurnDirection === 'straight' 
                  ? 'EMERGENCY: GOING STRAIGHT'
                  : `EMERGENCY: TURNING ${intersection.emergencyTurnDirection.toUpperCase()}`}
              </div>
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
