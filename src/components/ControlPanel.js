import React, { useState } from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import '../styles/ControlPanel.css';

const ControlPanel = () => {
  const {
    isPaused,
    setIsPaused,
    simulationSpeed,
    setSimulationSpeed,
    addVehicle,
    vehicles,
    emergencyActive,
    statistics
  } = useSimulation();

  const [demoMode, setDemoMode] = useState(false);

  const handleSpeedChange = (e) => {
    setSimulationSpeed(parseFloat(e.target.value));
  };

  const startDemo = () => {
    setDemoMode(true);
    setIsPaused(false);
    
    // Demo sequence
    setTimeout(() => addVehicle('car'), 500);
    setTimeout(() => addVehicle('bus'), 1500);
    setTimeout(() => addVehicle('car'), 2500);
    setTimeout(() => addVehicle('truck'), 3500);
    setTimeout(() => addVehicle('emergency'), 5000);
    setTimeout(() => addVehicle('car'), 6000);
    setTimeout(() => addVehicle('car'), 7000);
    
    setTimeout(() => setDemoMode(false), 15000);
  };

  return (
    <div className="control-panel">
      <h2>V2I System Control Panel</h2>
      
      <div className="control-section">
        <h3>Simulation Controls</h3>
        <div className="button-group">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={isPaused ? 'btn-warning' : 'btn-success'}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button onClick={startDemo} className="btn-primary" disabled={demoMode}>
            🎬 Start Demo
          </button>
        </div>

        <div className="speed-control">
          <label>
            Simulation Speed: {simulationSpeed}x
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={simulationSpeed}
              onChange={handleSpeedChange}
            />
          </label>
        </div>
      </div>

      <div className="control-section">
        <h3>Add Vehicles</h3>
        <div className="button-group">
          <button onClick={() => addVehicle('car')} className="btn-vehicle">
            🚗 Add Car
          </button>
          <button onClick={() => addVehicle('bus')} className="btn-vehicle">
            🚌 Add Bus
          </button>
          <button onClick={() => addVehicle('truck')} className="btn-vehicle">
            🚚 Add Truck
          </button>
          <button onClick={() => addVehicle('emergency')} className="btn-emergency">
            🚑 Add Emergency
          </button>
        </div>
      </div>

      <div className="control-section">
        <h3>Statistics</h3>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Active Vehicles:</span>
            <span className="stat-value">{vehicles.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Spawned:</span>
            <span className="stat-value">{statistics.totalVehicles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Emergency Events:</span>
            <span className="stat-value">{statistics.emergencyEvents}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Communication Links:</span>
            <span className="stat-value">{statistics.communicationMessages}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Emergency Active:</span>
            <span className={`stat-value ${emergencyActive ? 'emergency-active' : ''}`}>
              {emergencyActive ? '🚨 YES' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">
          🎬 Demo Mode Active
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
