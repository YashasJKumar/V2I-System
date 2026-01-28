import React from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import '../styles/CommunicationLinks.css';

const CommunicationLinks = () => {
  const { communicationLinks, vehicles, intersections } = useSimulation();

  // Find emergency vehicle communication links to nearest intersection
  const emergencyLinks = vehicles
    .filter(v => v.isEmergency)
    .map(ev => {
      // Find nearest intersection
      let nearestIntersection = null;
      let minDistance = Infinity;
      
      intersections.forEach(intersection => {
        const distance = Math.sqrt(
          Math.pow(ev.x - intersection.x, 2) + 
          Math.pow(ev.y - intersection.y, 2)
        );
        
        if (distance < 150 && distance < minDistance) {
          minDistance = distance;
          nearestIntersection = intersection;
        }
      });
      
      return nearestIntersection ? { vehicle: ev, intersection: nearestIntersection } : null;
    })
    .filter(link => link !== null);

  return (
    <svg className="communication-svg" width="900" height="700">
      {/* Regular V2V and V2I communication links */}
      {communicationLinks.map((link, index) => (
        <g key={index}>
          <line
            x1={link.from.x}
            y1={link.from.y}
            x2={link.to.x}
            y2={link.to.y}
            className={`comm-link ${link.type}`}
            strokeDasharray="5,5"
          />
          <circle
            cx={(link.from.x + link.to.x) / 2}
            cy={(link.from.y + link.to.y) / 2}
            r="3"
            className={`comm-indicator ${link.type}`}
          />
        </g>
      ))}
      
      {/* Emergency vehicle to signal communication beams */}
      {emergencyLinks.map((link, index) => {
        const { vehicle, intersection } = link;
        const dx = intersection.x - vehicle.x;
        const dy = intersection.y - vehicle.y;
        
        return (
          <g key={`emergency-${index}`}>
            {/* Main communication beam */}
            <line
              x1={vehicle.x}
              y1={vehicle.y}
              x2={intersection.x}
              y2={intersection.y}
              className="emergency-comm-beam"
              strokeDasharray="0"
              markerEnd="url(#arrowhead)"
            />
            
            {/* Animated data packets along the beam */}
            <circle
              cx={vehicle.x + dx * 0.3}
              cy={vehicle.y + dy * 0.3}
              r="4"
              className="emergency-data-packet"
            />
            <circle
              cx={vehicle.x + dx * 0.6}
              cy={vehicle.y + dy * 0.6}
              r="4"
              className="emergency-data-packet packet-2"
            />
          </g>
        );
      })}
      
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            fill="#00ff00"
            opacity="0.9"
          />
        </marker>
      </defs>
    </svg>
  );
};

export default CommunicationLinks;
