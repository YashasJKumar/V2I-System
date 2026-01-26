import React from 'react';
import { useSimulation } from '../contexts/SimulationContext';
import '../styles/CommunicationLinks.css';

const CommunicationLinks = () => {
  const { communicationLinks } = useSimulation();

  return (
    <svg className="communication-svg" width="900" height="700">
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
    </svg>
  );
};

export default CommunicationLinks;
