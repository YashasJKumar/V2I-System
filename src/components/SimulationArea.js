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
        {/* Horizontal roads */}
        <div className="road road-h" style={{ top: '190px' }}></div>
        <div className="road road-h" style={{ top: '490px' }}></div>
        
        {/* Vertical roads */}
        <div className="road road-v" style={{ left: '290px' }}></div>
        <div className="road road-v" style={{ left: '590px' }}></div>
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
