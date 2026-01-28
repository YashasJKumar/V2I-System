import React from 'react';
import '../styles/Vehicle.css';

const Vehicle = ({ vehicle }) => {
  const isEmergencyVehicle = (v) => {
    return v.isEmergency || v.type === 'emergency' || v.type === 'firetruck' || v.type === 'police';
  };

  const getVehicleClass = () => {
    if (isEmergencyVehicle(vehicle)) {
      if (vehicle.type === 'firetruck') return 'vehicle-firetruck';
      if (vehicle.type === 'police') return 'vehicle-police';
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
      className={`vehicle ${isEmergencyVehicle(vehicle) ? 'emergency' : ''} ${vehicle.stopped ? 'stopped' : ''}`}
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
        {isEmergencyVehicle(vehicle) && (
          <>
            <div className="emergency-light emergency-light-left"></div>
            <div className="emergency-light emergency-light-right"></div>
            {(vehicle.type === 'emergency' || vehicle.isEmergency) && (
              <div className="emergency-cross"></div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Vehicle;
