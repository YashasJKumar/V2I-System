import React from 'react';
import '../styles/Legend.css';

const Legend = () => {
  return (
    <div className="legend">
      <h3>Legend</h3>
      
      <div className="legend-section">
        <h4>Vehicles</h4>
        <div className="legend-item">
          <span className="legend-icon">🚗</span>
          <span>Regular Car</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">🚌</span>
          <span>Bus</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">🚚</span>
          <span>Truck</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">🚑</span>
          <span>Emergency Vehicle</span>
        </div>
      </div>

      <div className="legend-section">
        <h4>Traffic Signals</h4>
        <div className="legend-item">
          <span className="signal-dot red"></span>
          <span>Stop</span>
        </div>
        <div className="legend-item">
          <span className="signal-dot yellow"></span>
          <span>Caution</span>
        </div>
        <div className="legend-item">
          <span className="signal-dot green"></span>
          <span>Go</span>
        </div>
      </div>

      <div className="legend-section">
        <h4>Communication</h4>
        <div className="legend-item">
          <span className="comm-line v2v"></span>
          <span>V2V (Vehicle-to-Vehicle)</span>
        </div>
        <div className="legend-item">
          <span className="comm-line v2i"></span>
          <span>V2I (Vehicle-to-Infrastructure)</span>
        </div>
      </div>

      <div className="legend-section">
        <h4>Status Indicators</h4>
        <div className="legend-item">
          <span className="legend-icon">🚨</span>
          <span>Emergency Override Active</span>
        </div>
      </div>
    </div>
  );
};

export default Legend;
