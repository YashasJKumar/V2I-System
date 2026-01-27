import React from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import Intersection from './Intersection';
import Vehicle from './Vehicle';
import CommunicationLinks from './CommunicationLinks';
import '../styles/SimulationArea.css';

const SimulationArea = () => {
  const { vehicles, intersections } = useSimulation();

  return (
    <div className="simulation-area">
      {/* Road grid background */}
      <div className="road-grid">
        {/* Horizontal roads - 4 lanes each */}
        <div className="road road-h" style={{ top: '170px' }}></div>
        <div className="road road-h" style={{ top: '470px' }}></div>
        
        {/* Vertical roads - 4 lanes each */}
        <div className="road road-v" style={{ left: '270px' }}></div>
        <div className="road road-v" style={{ left: '570px' }}></div>
      </div>

      {/* Communication links (behind everything) */}
      <CommunicationLinks />

      {/* Intersections */}
      {intersections.map(intersection => (
        <Intersection key={intersection.id} intersection={intersection} />
      ))}

      {/* Vehicles */}
      {vehicles.map(vehicle => (
        <Vehicle key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
};

export default SimulationArea;
