import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SimulationContext = createContext();

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

// Traffic signal phases for each intersection - Indian style (independent directional control)
const SIGNAL_PHASES = {
  // Each direction is controlled independently
  NORTH_GREEN: 'NORTH_GREEN',
  NORTH_YELLOW: 'NORTH_YELLOW',
  NORTH_RED: 'NORTH_RED',
  SOUTH_GREEN: 'SOUTH_GREEN',
  SOUTH_YELLOW: 'SOUTH_YELLOW',
  SOUTH_RED: 'SOUTH_RED',
  EAST_GREEN: 'EAST_GREEN',
  EAST_YELLOW: 'EAST_YELLOW',
  EAST_RED: 'EAST_RED',
  WEST_GREEN: 'WEST_GREEN',
  WEST_YELLOW: 'WEST_YELLOW',
  WEST_RED: 'WEST_RED'
};

// Signal timing (in milliseconds)
const TIMING = {
  GREEN: 8000,
  YELLOW: 2000
};

// Vehicle behavior constants
const VEHICLE_CONSTANTS = {
  SAFE_DISTANCE: 40,           // Minimum safe distance between vehicles (px)
  LANE_TOLERANCE: 15,          // Tolerance for detecting vehicles in same lane (px)
  DECELERATION_FACTOR: 0.8,    // Speed reduction when following vehicle (0.0-1.0)
  INTERSECTION_CHECK_DISTANCE: 80,  // Distance to start checking for intersections and prepare to stop (px)
  EMERGENCY_OVERRIDE_DISTANCE: 150, // Distance for emergency override (px)
  EMERGENCY_CLEAR_DISTANCE: 200     // Distance to clear emergency override (px)
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
      { 
        id: 1, 
        x: 310, 
        y: 210, 
        signals: {
          north: { phase: SIGNAL_PHASES.NORTH_GREEN, timer: TIMING.GREEN },
          south: { phase: SIGNAL_PHASES.SOUTH_RED, timer: 0 },
          east: { phase: SIGNAL_PHASES.EAST_RED, timer: 0 },
          west: { phase: SIGNAL_PHASES.WEST_RED, timer: 0 }
        },
        emergencyOverride: false 
      },
      { 
        id: 2, 
        x: 610, 
        y: 210, 
        signals: {
          north: { phase: SIGNAL_PHASES.NORTH_RED, timer: 0 },
          south: { phase: SIGNAL_PHASES.SOUTH_RED, timer: 0 },
          east: { phase: SIGNAL_PHASES.EAST_GREEN, timer: TIMING.GREEN },
          west: { phase: SIGNAL_PHASES.WEST_RED, timer: 0 }
        },
        emergencyOverride: false 
      },
      { 
        id: 3, 
        x: 310, 
        y: 510, 
        signals: {
          north: { phase: SIGNAL_PHASES.NORTH_RED, timer: 0 },
          south: { phase: SIGNAL_PHASES.SOUTH_GREEN, timer: TIMING.GREEN },
          east: { phase: SIGNAL_PHASES.EAST_RED, timer: 0 },
          west: { phase: SIGNAL_PHASES.WEST_RED, timer: 0 }
        },
        emergencyOverride: false 
      },
      { 
        id: 4, 
        x: 610, 
        y: 510, 
        signals: {
          north: { phase: SIGNAL_PHASES.NORTH_RED, timer: 0 },
          south: { phase: SIGNAL_PHASES.SOUTH_RED, timer: 0 },
          east: { phase: SIGNAL_PHASES.EAST_RED, timer: 0 },
          west: { phase: SIGNAL_PHASES.WEST_GREEN, timer: TIMING.GREEN }
        },
        emergencyOverride: false 
      }
    ];
    setIntersections(initialIntersections);
  }, []);

  // Update traffic signals - Indian style cycling
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIntersections(prev => prev.map(intersection => {
        if (intersection.emergencyOverride) return intersection;

        const newSignals = { ...intersection.signals };
        let updated = false;

        // Update each direction independently
        ['north', 'south', 'east', 'west'].forEach(direction => {
          const signal = newSignals[direction];
          const newTimer = signal.timer - (100 * simulationSpeed);
          
          if (newTimer <= 0) {
            updated = true;
            // Transition to next phase for this direction
            if (signal.phase.includes('GREEN')) {
              newSignals[direction] = {
                phase: SIGNAL_PHASES[`${direction.toUpperCase()}_YELLOW`],
                timer: TIMING.YELLOW
              };
            } else if (signal.phase.includes('YELLOW')) {
              newSignals[direction] = {
                phase: SIGNAL_PHASES[`${direction.toUpperCase()}_RED`],
                timer: TIMING.GREEN // Time to stay red
              };
            } else if (signal.phase.includes('RED')) {
              // Check if we should turn this direction green
              // Simple cycle: one direction at a time
              const allRed = ['north', 'south', 'east', 'west'].every(d => 
                newSignals[d].phase.includes('RED')
              );
              
              if (allRed) {
                // All red, cycle to next direction
                const directionOrder = ['north', 'east', 'south', 'west'];
                const lastGreen = intersection.lastGreenDirection || 'west';
                const currentIndex = directionOrder.indexOf(lastGreen);
                const nextIndex = (currentIndex + 1) % directionOrder.length;
                const nextDirection = directionOrder[nextIndex];
                
                if (direction === nextDirection) {
                  newSignals[direction] = {
                    phase: SIGNAL_PHASES[`${direction.toUpperCase()}_GREEN`],
                    timer: TIMING.GREEN
                  };
                  intersection.lastGreenDirection = direction;
                }
              } else {
                newSignals[direction] = {
                  ...signal,
                  timer: TIMING.GREEN
                };
              }
            }
          } else {
            newSignals[direction] = {
              ...signal,
              timer: newTimer
            };
          }
        });

        return updated ? { ...intersection, signals: newSignals } : intersection;
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed]);

  // Add vehicle with optional turn direction for emergency vehicles
  const addVehicle = useCallback((type = 'car', turnDirection = null) => {
    // 4-lane routes - two lanes per direction with proper spacing
    // Each lane is 50px wide, 8px gap between same direction, 12px gap between opposite directions
    const routes = [
      // Horizontal roads - eastbound (top road, 2 lanes)
      { start: { x: -50, y: 172 }, end: { x: 950, y: 172 }, direction: 'EAST', lane: 1 }, // Right lane
      { start: { x: -50, y: 164 }, end: { x: 950, y: 164 }, direction: 'EAST', lane: 2 }, // Left lane
      // Horizontal roads - westbound (top road, 2 lanes)
      { start: { x: 950, y: 236 }, end: { x: -50, y: 236 }, direction: 'WEST', lane: 1 }, // Right lane
      { start: { x: 950, y: 244 }, end: { x: -50, y: 244 }, direction: 'WEST', lane: 2 }, // Left lane
      // Horizontal roads - eastbound (bottom road, 2 lanes)
      { start: { x: -50, y: 472 }, end: { x: 950, y: 472 }, direction: 'EAST', lane: 1 },
      { start: { x: -50, y: 464 }, end: { x: 950, y: 464 }, direction: 'EAST', lane: 2 },
      // Horizontal roads - westbound (bottom road, 2 lanes)
      { start: { x: 950, y: 536 }, end: { x: -50, y: 536 }, direction: 'WEST', lane: 1 },
      { start: { x: 950, y: 544 }, end: { x: -50, y: 544 }, direction: 'WEST', lane: 2 },
      // Vertical roads - southbound (left road, 2 lanes)
      { start: { x: 280, y: -50 }, end: { x: 280, y: 750 }, direction: 'SOUTH', lane: 1 },
      { start: { x: 272, y: -50 }, end: { x: 272, y: 750 }, direction: 'SOUTH', lane: 2 },
      // Vertical roads - northbound (left road, 2 lanes)
      { start: { x: 340, y: 750 }, end: { x: 340, y: -50 }, direction: 'NORTH', lane: 1 },
      { start: { x: 348, y: 750 }, end: { x: 348, y: -50 }, direction: 'NORTH', lane: 2 },
      // Vertical roads - southbound (right road, 2 lanes)
      { start: { x: 580, y: -50 }, end: { x: 580, y: 750 }, direction: 'SOUTH', lane: 1 },
      { start: { x: 572, y: -50 }, end: { x: 572, y: 750 }, direction: 'SOUTH', lane: 2 },
      // Vertical roads - northbound (right road, 2 lanes)
      { start: { x: 640, y: 750 }, end: { x: 640, y: -50 }, direction: 'NORTH', lane: 1 },
      { start: { x: 648, y: 750 }, end: { x: 648, y: -50 }, direction: 'NORTH', lane: 2 }
    ];

    const isEmergency = type === 'emergency' || type === 'firetruck' || type === 'police';
    
    // Regular vehicles prefer lane 1 (right lane), faster vehicles use lane 2
    let availableRoutes = routes;
    if (!isEmergency) {
      const preferLane1 = Math.random() < 0.7; // 70% in right lane
      availableRoutes = routes.filter(r => preferLane1 ? r.lane === 1 : r.lane === 2);
    }
    
    const route = availableRoutes[Math.floor(Math.random() * availableRoutes.length)];

    // Define turn routes for emergency vehicles - ALL FOUR APPROACH DIRECTIONS
    // Right turn = 90° clockwise, Left turn = 90° counter-clockwise
    const emergencyTurnRoutes = {
      'right': [
        // NORTH approach turning RIGHT (clockwise) → EAST
        { start: { x: 340, y: 750 }, waypoint: { x: 340, y: 210 }, end: { x: 950, y: 172 }, direction: 'NORTH', turnAt: { x: 310, y: 210 }, turnTo: 'EAST' },
        // EAST approach turning RIGHT (clockwise) → SOUTH
        { start: { x: -50, y: 172 }, waypoint: { x: 310, y: 172 }, end: { x: 280, y: 750 }, direction: 'EAST', turnAt: { x: 310, y: 210 }, turnTo: 'SOUTH' },
        // SOUTH approach turning RIGHT (clockwise) → WEST
        { start: { x: 280, y: -50 }, waypoint: { x: 280, y: 210 }, end: { x: -50, y: 236 }, direction: 'SOUTH', turnAt: { x: 310, y: 210 }, turnTo: 'WEST' },
        // WEST approach turning RIGHT (clockwise) → NORTH
        { start: { x: 950, y: 236 }, waypoint: { x: 310, y: 236 }, end: { x: 340, y: -50 }, direction: 'WEST', turnAt: { x: 310, y: 210 }, turnTo: 'NORTH' }
      ],
      'left': [
        // NORTH approach turning LEFT (counter-clockwise) → WEST
        { start: { x: 340, y: 750 }, waypoint: { x: 340, y: 210 }, end: { x: -50, y: 236 }, direction: 'NORTH', turnAt: { x: 310, y: 210 }, turnTo: 'WEST' },
        // EAST approach turning LEFT (counter-clockwise) → NORTH
        { start: { x: -50, y: 172 }, waypoint: { x: 310, y: 172 }, end: { x: 340, y: -50 }, direction: 'EAST', turnAt: { x: 310, y: 210 }, turnTo: 'NORTH' },
        // SOUTH approach turning LEFT (counter-clockwise) → EAST
        { start: { x: 280, y: -50 }, waypoint: { x: 280, y: 210 }, end: { x: 950, y: 172 }, direction: 'SOUTH', turnAt: { x: 310, y: 210 }, turnTo: 'EAST' },
        // WEST approach turning LEFT (counter-clockwise) → SOUTH
        { start: { x: 950, y: 236 }, waypoint: { x: 310, y: 236 }, end: { x: 280, y: 750 }, direction: 'WEST', turnAt: { x: 310, y: 210 }, turnTo: 'SOUTH' }
      ]
    };

    let selectedRoute = route;
    let path = null;
    
    // Only apply turn routes for actual turns (not straight)
    if (isEmergency && turnDirection && turnDirection !== 'straight' && emergencyTurnRoutes[turnDirection]) {
      const turnRoutes = emergencyTurnRoutes[turnDirection];
      const turnRoute = turnRoutes[Math.floor(Math.random() * turnRoutes.length)];
      selectedRoute = turnRoute;
      path = [
        { x: turnRoute.start.x, y: turnRoute.start.y },
        { x: turnRoute.waypoint.x, y: turnRoute.waypoint.y },
        { x: turnRoute.end.x, y: turnRoute.end.y }
      ];
    }

    const newVehicle = {
      id: Date.now() + Math.random(),
      type: type,
      x: selectedRoute.start.x,
      y: selectedRoute.start.y,
      targetX: path ? path[1].x : selectedRoute.end.x,
      targetY: path ? path[1].y : selectedRoute.end.y,
      direction: selectedRoute.direction,
      speed: isEmergency ? 4 : (type === 'bus' ? 1.5 : 2),
      stopped: false,
      status: 'moving',
      isEmergency,
      turnDirection: turnDirection,
      turnAt: selectedRoute.turnAt,
      turnTo: selectedRoute.turnTo,
      path: path,
      pathIndex: path ? 1 : null,
      lane: selectedRoute.lane || 1
    };

    // Debug logging for emergency vehicles
    if (isEmergency) {
      console.log(`${type} spawned with turn direction: ${turnDirection || 'straight'}`);
    }

    setVehicles(prev => [...prev, newVehicle]);
    setStatistics(prev => ({ 
      ...prev, 
      totalVehicles: prev.totalVehicles + 1,
      emergencyEvents: isEmergency ? prev.emergencyEvents + 1 : prev.emergencyEvents
    }));

    if (isEmergency) {
      setEmergencyActive(true);
    }
  }, [setVehicles, setStatistics, setEmergencyActive]);

  // Remove vehicle
  const removeVehicle = useCallback((id) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  }, [setVehicles]);

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

          // COLLISION DETECTION: Check for vehicles ahead
          const safeDistance = VEHICLE_CONSTANTS.SAFE_DISTANCE;
          let vehicleAhead = null;
          let minDistanceToVehicle = Infinity;

          prev.forEach(otherVehicle => {
            if (otherVehicle.id === vehicle.id) return;

            // Calculate distance to other vehicle
            const distToOther = Math.sqrt(
              Math.pow(otherVehicle.x - vehicle.x, 2) + 
              Math.pow(otherVehicle.y - vehicle.y, 2)
            );

            // Check if the other vehicle is in the same direction and ahead
            const laneTolerance = VEHICLE_CONSTANTS.LANE_TOLERANCE;
            const isAhead = 
              (vehicle.direction === 'EAST' && otherVehicle.x > vehicle.x && Math.abs(otherVehicle.y - vehicle.y) < laneTolerance && otherVehicle.direction === 'EAST') ||
              (vehicle.direction === 'WEST' && otherVehicle.x < vehicle.x && Math.abs(otherVehicle.y - vehicle.y) < laneTolerance && otherVehicle.direction === 'WEST') ||
              (vehicle.direction === 'SOUTH' && otherVehicle.y > vehicle.y && Math.abs(otherVehicle.x - vehicle.x) < laneTolerance && otherVehicle.direction === 'SOUTH') ||
              (vehicle.direction === 'NORTH' && otherVehicle.y < vehicle.y && Math.abs(otherVehicle.x - vehicle.x) < laneTolerance && otherVehicle.direction === 'NORTH');

            if (isAhead && distToOther < minDistanceToVehicle) {
              minDistanceToVehicle = distToOther;
              vehicleAhead = otherVehicle;
            }
          });

          // Check for traffic signals with Indian-style independent control
          let shouldStop = false;
          const checkDistance = VEHICLE_CONSTANTS.INTERSECTION_CHECK_DISTANCE;

          intersections.forEach(intersection => {
            const distToIntersection = Math.sqrt(
              Math.pow(vehicle.x - intersection.x, 2) + 
              Math.pow(vehicle.y - intersection.y, 2)
            );

            if (distToIntersection < checkDistance) {
              // Emergency vehicles always go
              if (vehicle.isEmergency) {
                shouldStop = false;
              } else {
                // Check signal for specific direction
                const directionKey = vehicle.direction.toLowerCase();
                const signal = intersection.signals[directionKey];
                
                if (signal) {
                  // Stop if signal is red or yellow
                  shouldStop = signal.phase.includes('RED') || signal.phase.includes('YELLOW');
                }
              }
            }
          });

          // VEHICLE FOLLOWING LOGIC
          if (vehicleAhead && minDistanceToVehicle < safeDistance) {
            // If vehicle ahead is stopped, current vehicle stops
            if (vehicleAhead.stopped) {
              return { ...vehicle, stopped: true, status: 'stopped (queue)' };
            }
            // If vehicle ahead is moving, match its speed (decelerate)
            else {
              const reducedSpeed = vehicleAhead.speed * simulationSpeed * VEHICLE_CONSTANTS.DECELERATION_FACTOR;
              const angle = Math.atan2(dy, dx);
              const newX = vehicle.x + Math.cos(angle) * reducedSpeed;
              const newY = vehicle.y + Math.sin(angle) * reducedSpeed;
              
              return {
                ...vehicle,
                x: newX,
                y: newY,
                stopped: false,
                status: 'following'
              };
            }
          }

          if (shouldStop) {
            return { ...vehicle, stopped: true, status: 'stopped' };
          }

          // Check if vehicle has reached waypoint and needs to update target
          if (vehicle.path && vehicle.pathIndex < vehicle.path.length) {
            if (distance < 10) {
              // Reached current waypoint, move to next
              const nextIndex = vehicle.pathIndex + 1;
              if (nextIndex < vehicle.path.length) {
                const nextWaypoint = vehicle.path[nextIndex];
                // Update direction based on turn
                let newDirection = vehicle.direction;
                if (vehicle.turnTo) {
                  newDirection = vehicle.turnTo;
                  // Debug logging for turn execution
                  if (vehicle.isEmergency) {
                    console.log(`${vehicle.type} reaching intersection, executing: ${vehicle.turnDirection}`);
                  }
                }
                return {
                  ...vehicle,
                  targetX: nextWaypoint.x,
                  targetY: nextWaypoint.y,
                  direction: newDirection,
                  pathIndex: nextIndex,
                  status: vehicle.turnDirection ? `turning ${vehicle.turnDirection}` : 'moving'
                };
              } else {
                // Reached final waypoint
                return null;
              }
            }
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
            status: vehicle.turnDirection && vehicle.pathIndex === 1 ? `turning ${vehicle.turnDirection}` : 'moving'
          };
        });

        return updated.filter(v => v !== null);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed, intersections]);

  // Emergency vehicle priority system - Indian style independent control
  useEffect(() => {
    const emergencyVehicles = vehicles.filter(v => v.isEmergency);
    
    if (emergencyVehicles.length === 0) {
      setEmergencyActive(false);
      // Reset all emergency overrides
      setIntersections(prev => prev.map(int => ({
        ...int,
        emergencyOverride: false,
        emergencyTurnDirection: null
      })));
      return;
    }

    // Set signals to green for emergency vehicle - ONLY the specific direction needed
    setIntersections(prev => prev.map(intersection => {
      let updatedIntersection = { ...intersection };
      let hasEmergencyOverride = false;
      
      emergencyVehicles.forEach(ev => {
        const distance = Math.sqrt(
          Math.pow(ev.x - updatedIntersection.x, 2) + 
          Math.pow(ev.y - updatedIntersection.y, 2)
        );

        if (distance < VEHICLE_CONSTANTS.EMERGENCY_OVERRIDE_DISTANCE) {
          hasEmergencyOverride = true;
          
          // Determine which direction to turn green based on vehicle's current direction
          let targetDirection;
          
          // If vehicle is turning and close to intersection, use the turn target direction
          if (ev.turnDirection && ev.turnDirection !== 'straight' && distance < 50 && ev.turnTo) {
            targetDirection = ev.turnTo.toLowerCase();
          } else {
            // Otherwise use current direction
            targetDirection = ev.direction.toLowerCase();
          }
          
          // Set ONLY the emergency vehicle's direction to green, all others to red
          const newSignals = {
            north: { phase: SIGNAL_PHASES.NORTH_RED, timer: 0 },
            south: { phase: SIGNAL_PHASES.SOUTH_RED, timer: 0 },
            east: { phase: SIGNAL_PHASES.EAST_RED, timer: 0 },
            west: { phase: SIGNAL_PHASES.WEST_RED, timer: 0 }
          };
          
          // Turn only the target direction green
          if (targetDirection === 'north' || targetDirection === 'south' || 
              targetDirection === 'east' || targetDirection === 'west') {
            newSignals[targetDirection] = {
              phase: SIGNAL_PHASES[`${targetDirection.toUpperCase()}_GREEN`],
              timer: TIMING.GREEN
            };
          }
          
          updatedIntersection = {
            ...updatedIntersection,
            emergencyOverride: true,
            signals: newSignals,
            emergencyTurnDirection: ev.turnDirection || 'straight'
          };
        } else if (distance > VEHICLE_CONSTANTS.EMERGENCY_CLEAR_DISTANCE) {
          if (!hasEmergencyOverride) {
            updatedIntersection = {
              ...updatedIntersection,
              emergencyOverride: false,
              emergencyTurnDirection: null
            };
          }
        }
      });
      
      return updatedIntersection;
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
