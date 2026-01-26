import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SimulationContext = createContext();

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

// Traffic signal phases for each intersection
const SIGNAL_PHASES = {
  NORTH_SOUTH_GREEN: 'NS_GREEN',
  NORTH_SOUTH_YELLOW: 'NS_YELLOW',
  EAST_WEST_GREEN: 'EW_GREEN',
  EAST_WEST_YELLOW: 'EW_YELLOW'
};

// Signal timing (in milliseconds)
const TIMING = {
  GREEN: 8000,
  YELLOW: 2000
};

export const SimulationProvider = ({ children }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [intersections, setIntersections] = useState([]);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [communicationLinks, setCommunicationLinks] = useState([]);
  const [statistics, setStatistics] = useState({
    totalVehicles: 0,
    emergencyEvents: 0,
    communicationMessages: 0
  });

  // Initialize intersections
  useEffect(() => {
    const initialIntersections = [
      { id: 1, x: 300, y: 200, phase: SIGNAL_PHASES.NORTH_SOUTH_GREEN, timer: TIMING.GREEN, emergencyOverride: false },
      { id: 2, x: 600, y: 200, phase: SIGNAL_PHASES.EAST_WEST_GREEN, timer: TIMING.GREEN, emergencyOverride: false },
      { id: 3, x: 300, y: 500, phase: SIGNAL_PHASES.NORTH_SOUTH_GREEN, timer: TIMING.GREEN, emergencyOverride: false },
      { id: 4, x: 600, y: 500, phase: SIGNAL_PHASES.EAST_WEST_GREEN, timer: TIMING.GREEN, emergencyOverride: false }
    ];
    setIntersections(initialIntersections);
  }, []);

  // Update traffic signals
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIntersections(prev => prev.map(intersection => {
        if (intersection.emergencyOverride) return intersection;

        const newTimer = intersection.timer - (100 * simulationSpeed);
        if (newTimer <= 0) {
          // Transition to next phase
          let newPhase;
          let newTimer;
          
          switch (intersection.phase) {
            case SIGNAL_PHASES.NORTH_SOUTH_GREEN:
              newPhase = SIGNAL_PHASES.NORTH_SOUTH_YELLOW;
              newTimer = TIMING.YELLOW;
              break;
            case SIGNAL_PHASES.NORTH_SOUTH_YELLOW:
              newPhase = SIGNAL_PHASES.EAST_WEST_GREEN;
              newTimer = TIMING.GREEN;
              break;
            case SIGNAL_PHASES.EAST_WEST_GREEN:
              newPhase = SIGNAL_PHASES.EAST_WEST_YELLOW;
              newTimer = TIMING.YELLOW;
              break;
            case SIGNAL_PHASES.EAST_WEST_YELLOW:
              newPhase = SIGNAL_PHASES.NORTH_SOUTH_GREEN;
              newTimer = TIMING.GREEN;
              break;
            default:
              newPhase = SIGNAL_PHASES.NORTH_SOUTH_GREEN;
              newTimer = TIMING.GREEN;
          }
          
          return { ...intersection, phase: newPhase, timer: newTimer };
        }
        
        return { ...intersection, timer: newTimer };
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed]);

  // Add vehicle
  const addVehicle = useCallback((type = 'car') => {
    const routes = [
      { start: { x: -50, y: 190 }, end: { x: 950, y: 190 }, direction: 'EAST' },
      { start: { x: 950, y: 210 }, end: { x: -50, y: 210 }, direction: 'WEST' },
      { start: { x: 290, y: -50 }, end: { x: 290, y: 750 }, direction: 'SOUTH' },
      { start: { x: 310, y: 750 }, end: { x: 310, y: -50 }, direction: 'NORTH' },
      { start: { x: 590, y: -50 }, end: { x: 590, y: 750 }, direction: 'SOUTH' },
      { start: { x: 610, y: 750 }, end: { x: 610, y: -50 }, direction: 'NORTH' }
    ];

    const route = routes[Math.floor(Math.random() * routes.length)];
    const isEmergency = type === 'emergency';

    const newVehicle = {
      id: Date.now() + Math.random(),
      type: isEmergency ? 'emergency' : type,
      x: route.start.x,
      y: route.start.y,
      targetX: route.end.x,
      targetY: route.end.y,
      direction: route.direction,
      speed: isEmergency ? 4 : 2,
      stopped: false,
      status: 'moving',
      isEmergency
    };

    setVehicles(prev => [...prev, newVehicle]);
    setStatistics(prev => ({ 
      ...prev, 
      totalVehicles: prev.totalVehicles + 1,
      emergencyEvents: isEmergency ? prev.emergencyEvents + 1 : prev.emergencyEvents
    }));

    if (isEmergency) {
      setEmergencyActive(true);
    }
  }, []);

  // Remove vehicle
  const removeVehicle = useCallback((id) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  }, []);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setVehicles(prev => {
        const updated = prev.map(vehicle => {
          // Check if vehicle reached destination
          const dx = vehicle.targetX - vehicle.x;
          const dy = vehicle.targetY - vehicle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 5) {
            return null; // Mark for removal
          }

          // Check for traffic signals
          let shouldStop = false;
          const checkDistance = 40;

          intersections.forEach(intersection => {
            const distToIntersection = Math.sqrt(
              Math.pow(vehicle.x - intersection.x, 2) + 
              Math.pow(vehicle.y - intersection.y, 2)
            );

            if (distToIntersection < checkDistance) {
              const phase = intersection.phase;
              
              // Emergency vehicles always go
              if (vehicle.isEmergency) {
                shouldStop = false;
              } else {
                // Check if signal is red for this direction
                if (vehicle.direction === 'EAST' || vehicle.direction === 'WEST') {
                  shouldStop = phase === SIGNAL_PHASES.NORTH_SOUTH_GREEN || 
                               phase === SIGNAL_PHASES.NORTH_SOUTH_YELLOW;
                } else {
                  shouldStop = phase === SIGNAL_PHASES.EAST_WEST_GREEN || 
                               phase === SIGNAL_PHASES.EAST_WEST_YELLOW;
                }
              }
            }
          });

          if (shouldStop) {
            return { ...vehicle, stopped: true, status: 'stopped' };
          }

          // Move vehicle
          const speed = vehicle.speed * simulationSpeed;
          const angle = Math.atan2(dy, dx);
          const newX = vehicle.x + Math.cos(angle) * speed;
          const newY = vehicle.y + Math.sin(angle) * speed;

          return {
            ...vehicle,
            x: newX,
            y: newY,
            stopped: false,
            status: 'moving'
          };
        });

        return updated.filter(v => v !== null);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed, intersections]);

  // Emergency vehicle priority system
  useEffect(() => {
    const emergencyVehicles = vehicles.filter(v => v.isEmergency);
    
    if (emergencyVehicles.length === 0) {
      setEmergencyActive(false);
      // Reset all emergency overrides
      setIntersections(prev => prev.map(int => ({
        ...int,
        emergencyOverride: false
      })));
      return;
    }

    // Set signals to green for emergency vehicle path
    setIntersections(prev => prev.map(intersection => {
      emergencyVehicles.forEach(ev => {
        const distance = Math.sqrt(
          Math.pow(ev.x - intersection.x, 2) + 
          Math.pow(ev.y - intersection.y, 2)
        );

        if (distance < 150) {
          intersection.emergencyOverride = true;
          
          // Set appropriate green signal
          if (ev.direction === 'EAST' || ev.direction === 'WEST') {
            intersection.phase = SIGNAL_PHASES.EAST_WEST_GREEN;
          } else {
            intersection.phase = SIGNAL_PHASES.NORTH_SOUTH_GREEN;
          }
        } else if (distance > 200) {
          intersection.emergencyOverride = false;
        }
      });
      
      return intersection;
    }));
  }, [vehicles]);

  // V2V and V2I Communication simulation
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const links = [];
      
      // V2V: Vehicle to vehicle communication
      vehicles.forEach((v1, i) => {
        vehicles.slice(i + 1).forEach(v2 => {
          const distance = Math.sqrt(
            Math.pow(v1.x - v2.x, 2) + 
            Math.pow(v1.y - v2.y, 2)
          );
          
          if (distance < 100) {
            links.push({
              type: 'V2V',
              from: { x: v1.x, y: v1.y },
              to: { x: v2.x, y: v2.y }
            });
          }
        });

        // V2I: Vehicle to infrastructure communication
        intersections.forEach(intersection => {
          const distance = Math.sqrt(
            Math.pow(v1.x - intersection.x, 2) + 
            Math.pow(v1.y - intersection.y, 2)
          );
          
          if (distance < 80) {
            links.push({
              type: 'V2I',
              from: { x: v1.x, y: v1.y },
              to: { x: intersection.x, y: intersection.y }
            });
          }
        });
      });

      setCommunicationLinks(links);
      setStatistics(prev => ({ 
        ...prev, 
        communicationMessages: links.length 
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [vehicles, intersections, isPaused]);

  const value = {
    isPaused,
    setIsPaused,
    simulationSpeed,
    setSimulationSpeed,
    vehicles,
    intersections,
    emergencyActive,
    communicationLinks,
    statistics,
    addVehicle,
    removeVehicle,
    SIGNAL_PHASES
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};
