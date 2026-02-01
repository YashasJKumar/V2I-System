import React, { useState, useEffect } from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import '../styles/CommunicationLinks.css';

const CommunicationLinks = () => {
  const { communicationLinks, v2iMessages, vehicles, intersections } = useSimulation();
  const [animationProgress, setAnimationProgress] = useState(0);

  // Animation loop for packet movement
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationProgress((prev) => (prev + 0.05) % 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

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

      {/* Enhanced V2I Emergency Broadcasts - Show beams to all approaching intersections */}
      {v2iMessages.map((message, index) => {
        const vehicle = vehicles.find(v => v.id === message.vehicleId);
        if (!vehicle) return null;

        return message.approachingIntersections.map(intersectionId => {
          const intersection = intersections.find(i => i.id === intersectionId);
          if (!intersection) return null;

          return (
            <g key={`${index}-${intersectionId}`}>
              {/* V2I Communication beam */}
              <line
                x1={vehicle.x}
                y1={vehicle.y}
                x2={intersection.x}
                y2={intersection.y}
                className="v2i-emergency-beam"
                strokeWidth="3"
                stroke="cyan"
                strokeDasharray="10,5"
                opacity="0.8"
              />
              
              {/* Animated data packet traveling from vehicle to intersection */}
              <circle
                cx={vehicle.x + (intersection.x - vehicle.x) * animationProgress}
                cy={vehicle.y + (intersection.y - vehicle.y) * animationProgress}
                r="5"
                fill="cyan"
                className="v2i-packet"
              />

              {/* Label at midpoint */}
              <text
                x={(vehicle.x + intersection.x) / 2}
                y={(vehicle.y + intersection.y) / 2 - 10}
                fill="cyan"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                className="v2i-label"
              >
                V2I: PRIORITY
              </text>
            </g>
          );
        });
      })}
    </svg>
  );
};

export default CommunicationLinks;
