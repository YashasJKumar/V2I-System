import React from 'react';
import '../styles/Vehicle.css';

const Vehicle = ({ vehicle }) => {
  const getVehicleClass = () => {
    if (vehicle.isEmergency) {
      return 'vehicle-ambulance';
    }
    switch (vehicle.type) {
      case 'bus':
        return 'vehicle-bus';
      case 'truck':
        return 'vehicle-truck';
      default:
        return 'vehicle-car';
    }
  };

  const getRotation = () => {
    switch (vehicle.direction) {
      case 'NORTH':
        return 0;
      case 'EAST':
        return 90;
      case 'SOUTH':
        return 180;
      case 'WEST':
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
        transform: `translate(-50%, -50%)`
      }}
    >
      <div 
        className={`vehicle-body ${getVehicleClass()}`}
        style={{
          transform: `rotate(${getRotation()}deg)`
        }}
      >
        {vehicle.isEmergency && (
          <>
            <div className="emergency-light emergency-light-left"></div>
            <div className="emergency-light emergency-light-right"></div>
            <div className="emergency-cross"></div>
          </>
        )}
      </div>
      {vehicle.isEmergency && vehicle.turnDirection && (
        <div className="turn-indicator">
          {vehicle.turnDirection === 'right' ? '➡️' : '⬅️'}
        </div>
      )}
    </div>
  );
};

export default Vehicle;
