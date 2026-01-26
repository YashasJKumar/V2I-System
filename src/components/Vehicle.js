import React from 'react';
import '../styles/Vehicle.css';

const Vehicle = ({ vehicle }) => {
  const getVehicleIcon = () => {
    if (vehicle.isEmergency) {
      return '🚑';
    }
    switch (vehicle.type) {
      case 'bus':
        return '🚌';
      case 'truck':
        return '🚚';
      default:
        return '🚗';
    }
  };

  const getRotation = () => {
    switch (vehicle.direction) {
      case 'EAST':
        return 0;
      case 'WEST':
        return 180;
      case 'SOUTH':
        return 90;
      case 'NORTH':
        return 270;
      default:
        return 0;
    }
  };

  return (
    <div
      className={`vehicle ${vehicle.isEmergency ? 'emergency' : ''} ${vehicle.stopped ? 'stopped' : ''}`}
      style={{
        left: `${vehicle.x}px`,
        top: `${vehicle.y}px`,
        transform: `translate(-50%, -50%) rotate(${getRotation()}deg)`
      }}
    >
      <div className="vehicle-icon">{getVehicleIcon()}</div>
      {vehicle.isEmergency && (
        <div className="emergency-light"></div>
      )}
      <div className="vehicle-status">
        {vehicle.status}
      </div>
    </div>
  );
};

export default Vehicle;
