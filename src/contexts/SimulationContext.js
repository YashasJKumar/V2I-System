import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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
  EMERGENCY_CLEAR_DISTANCE: 200,    // Distance to clear emergency override (px)
  DETECTION_DISTANCE: 200,     // Distance for detecting approaching emergency vehicles (px)
  PREEMPTION_DISTANCE: 150,    // Distance to start signal preemption (px)
  PREEMPTION_MIN_DISTANCE: 50, // Minimum distance for preemption to activate (px)
  INTERSECTION_SIZE: 120,       // Size of intersection boundary (px)
  EMERGENCY_STOP_THRESHOLD: 30, // Distance threshold for vehicles to stop when emergency approaches (px)
  TURN_DIRECTION_SWITCH_DISTANCE: 80, // Distance to switch to turn target direction (px)
  WAYPOINT_REACH_DISTANCE: 10, // Distance to consider waypoint reached (px)
  DESTINATION_REACH_DISTANCE: 5 // Distance to consider destination reached (px)
};

export const SimulationProvider = ({ children }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [intersections, setIntersections] = useState([]);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [communicationLinks, setCommunicationLinks] = useState([]);
  const preemptionLoggedRef = useRef(new Map());
  const [v2iMessages, setV2iMessages] = useState([]); // Track V2I messages for visualization
  const [statistics, setStatistics] = useState({
    totalVehicles: 0,
    emergencyEvents: 0,
    communicationMessages: 0,
    v2iBroadcasts: 0
  });

  // Initialize intersections with enhanced V2I capabilities
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
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
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
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
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
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
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
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
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
      console.log(`🚑 ${type} spawned with turn direction: ${turnDirection || 'straight'}, ID: ${newVehicle.id.toFixed(2)}`);
      console.log(`   Route: from (${selectedRoute.start.x}, ${selectedRoute.start.y}) to (${selectedRoute.end.x}, ${selectedRoute.end.y})`);
      if (path) {
        console.log(`   Path waypoints:`, path);
      }
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

  // Helper function to check if vehicle is inside intersection boundary
  const isInIntersection = useCallback((vehicle, intersection) => {
    const halfSize = VEHICLE_CONSTANTS.INTERSECTION_SIZE / 2;
    const inX = Math.abs(vehicle.x - intersection.x) < halfSize;
    const inY = Math.abs(vehicle.y - intersection.y) < halfSize;
    return inX && inY;
  }, []);

  // Update vehicle positions
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setVehicles(prev => {
        // Check which vehicles are inside intersections for Bug #3 fix
        const vehiclesInIntersections = new Set();
        prev.forEach(vehicle => {
          intersections.forEach(intersection => {
            if (isInIntersection(vehicle, intersection)) {
              vehiclesInIntersections.add(vehicle.id);
            }
          });
        });

        // CONGESTION HANDLING: Detect emergency vehicles behind queues
        const emergencyVehicles = prev.filter(v => v.isEmergency);
        const queueClearanceNeeded = new Map(); // Map of intersection ID to emergency vehicle

        emergencyVehicles.forEach(ev => {
          // Find vehicles ahead in same lane
          const vehiclesAhead = [];
          prev.forEach(otherVehicle => {
            if (otherVehicle.id === ev.id || otherVehicle.isEmergency) return;

            const distToOther = Math.sqrt(
              Math.pow(otherVehicle.x - ev.x, 2) + 
              Math.pow(otherVehicle.y - ev.y, 2)
            );

            const laneTolerance = VEHICLE_CONSTANTS.LANE_TOLERANCE;
            const isAhead = 
              (ev.direction === 'EAST' && otherVehicle.x > ev.x && Math.abs(otherVehicle.y - ev.y) < laneTolerance) ||
              (ev.direction === 'WEST' && otherVehicle.x < ev.x && Math.abs(otherVehicle.y - ev.y) < laneTolerance) ||
              (ev.direction === 'SOUTH' && otherVehicle.y > ev.y && Math.abs(otherVehicle.x - ev.x) < laneTolerance) ||
              (ev.direction === 'NORTH' && otherVehicle.y < ev.y && Math.abs(otherVehicle.x - ev.x) < laneTolerance);

            if (isAhead && distToOther < 200) {
              vehiclesAhead.push({ vehicle: otherVehicle, distance: distToOther });
            }
          });

          if (vehiclesAhead.length > 0) {
            console.log(`🚨 Emergency vehicle ${ev.id.toFixed(2)} blocked by ${vehiclesAhead.length} vehicle(s)`);
            
            // Find the intersection ahead
            intersections.forEach(intersection => {
              const distToInt = Math.sqrt(
                Math.pow(ev.x - intersection.x, 2) + 
                Math.pow(ev.y - intersection.y, 2)
              );

              const isIntAhead = 
                (ev.direction === 'EAST' && intersection.x > ev.x) ||
                (ev.direction === 'WEST' && intersection.x < ev.x) ||
                (ev.direction === 'SOUTH' && intersection.y > ev.y) ||
                (ev.direction === 'NORTH' && intersection.y < ev.y);

              if (isIntAhead && distToInt < 300) {
                queueClearanceNeeded.set(intersection.id, {
                  emergencyVehicle: ev,
                  queueSize: vehiclesAhead.length
                });
              }
            });
          }
        });

        const updated = prev.map(vehicle => {
          // Check if vehicle reached destination
          const dx = vehicle.targetX - vehicle.x;
          const dy = vehicle.targetY - vehicle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < VEHICLE_CONSTANTS.DESTINATION_REACH_DISTANCE) {
            return null; // Mark for removal
          }

          // QUEUE CLEARANCE: Allow vehicles to move if emergency is behind
          let allowedToMoveForEmergency = false;
          intersections.forEach(intersection => {
            if (queueClearanceNeeded.has(intersection.id)) {
              const { emergencyVehicle } = queueClearanceNeeded.get(intersection.id);
              
              // Check if this vehicle is between emergency and intersection
              const distToInt = Math.sqrt(
                Math.pow(vehicle.x - intersection.x, 2) + 
                Math.pow(vehicle.y - intersection.y, 2)
              );

              const distEvToInt = Math.sqrt(
                Math.pow(emergencyVehicle.x - intersection.x, 2) + 
                Math.pow(emergencyVehicle.y - intersection.y, 2)
              );

              const laneTolerance = VEHICLE_CONSTANTS.LANE_TOLERANCE;
              const inSameLane = 
                (vehicle.direction === emergencyVehicle.direction) &&
                ((vehicle.direction === 'EAST' || vehicle.direction === 'WEST') ? 
                  Math.abs(vehicle.y - emergencyVehicle.y) < laneTolerance :
                  Math.abs(vehicle.x - emergencyVehicle.x) < laneTolerance);

              if (inSameLane && distToInt < distEvToInt && distToInt < 200) {
                allowedToMoveForEmergency = true;
                console.log(`🚗 Vehicle ${vehicle.id.toFixed(2)} received EMERGENCY CLEARANCE - moving through`);
              }
            }
          });

          // BUG #4 FIX: Emergency vehicles should NEVER stop for collision detection
          // They have absolute priority
          let vehicleAhead = null;
          let minDistanceToVehicle = Infinity;

          if (!vehicle.isEmergency) {
            // COLLISION DETECTION: Only for non-emergency vehicles
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
          }

          // Check for traffic signals with Indian-style independent control
          let shouldStop = false;
          const checkDistance = VEHICLE_CONSTANTS.INTERSECTION_CHECK_DISTANCE;

          // BUG #3 FIX: Check if emergency vehicle is approaching any intersection
          const emergencyApproaching = prev.some(v => {
            if (!v.isEmergency) return false;
            return intersections.some(intersection => {
              const dist = Math.sqrt(
                Math.pow(v.x - intersection.x, 2) + 
                Math.pow(v.y - intersection.y, 2)
              );
              return dist < VEHICLE_CONSTANTS.DETECTION_DISTANCE;
            });
          });

          intersections.forEach(intersection => {
            const distToIntersection = Math.sqrt(
              Math.pow(vehicle.x - intersection.x, 2) + 
              Math.pow(vehicle.y - intersection.y, 2)
            );

            if (distToIntersection < checkDistance) {
              // BUG #4 FIX: Emergency vehicles NEVER stop
              if (vehicle.isEmergency) {
                shouldStop = false;
              } 
              // QUEUE CLEARANCE: If vehicle has emergency clearance, allow it to proceed
              else if (allowedToMoveForEmergency) {
                shouldStop = false;
              }
              // BUG #3 FIX: If vehicle is already in intersection when emergency approaches, let it continue
              else if (emergencyApproaching && vehiclesInIntersections.has(vehicle.id)) {
                // Allow vehicles already in intersection to continue
                shouldStop = false;
              }
              // BUG #3 FIX: Stop vehicles approaching intersection (not yet inside) when emergency is coming
              else if (emergencyApproaching && !vehiclesInIntersections.has(vehicle.id) && distToIntersection > VEHICLE_CONSTANTS.EMERGENCY_STOP_THRESHOLD) {
                shouldStop = true;
              }
              else {
                // Normal signal check for non-emergency situations
                const directionKey = vehicle.direction.toLowerCase();
                const signal = intersection.signals[directionKey];
                
                if (signal) {
                  // Stop if signal is red or yellow
                  shouldStop = signal.phase.includes('RED') || signal.phase.includes('YELLOW');
                }
              }
            }
          });

          // BUG #4 FIX: VEHICLE FOLLOWING LOGIC - Not for emergency vehicles
          if (!vehicle.isEmergency && vehicleAhead && minDistanceToVehicle < VEHICLE_CONSTANTS.SAFE_DISTANCE && !allowedToMoveForEmergency) {
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

          if (shouldStop && !allowedToMoveForEmergency) {
            return { ...vehicle, stopped: true, status: 'stopped' };
          }

          // BUG #1 FIX: Check if vehicle has reached waypoint and needs to update target
          if (vehicle.path && vehicle.pathIndex < vehicle.path.length) {
            if (distance < VEHICLE_CONSTANTS.WAYPOINT_REACH_DISTANCE) {
              // Reached current waypoint, move to next
              const nextIndex = vehicle.pathIndex + 1;
              if (nextIndex < vehicle.path.length) {
                const nextWaypoint = vehicle.path[nextIndex];
                // BUG #1 FIX: Update direction based on turn - this is where the turn executes
                let newDirection = vehicle.direction;
                if (vehicle.turnTo && vehicle.pathIndex === 1) {
                  // This is the turn execution point
                  newDirection = vehicle.turnTo;
                  // Debug logging for turn execution
                  if (vehicle.isEmergency) {
                    console.log(`🚑 ${vehicle.type} ID ${vehicle.id.toFixed(2)} at intersection, executing: ${vehicle.turnDirection}`);
                    console.log(`   Direction change: ${vehicle.direction} → ${newDirection}`);
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
                if (vehicle.isEmergency) {
                  console.log(`🚑 ${vehicle.type} ID ${vehicle.id.toFixed(2)} completed journey - turn was: ${vehicle.turnDirection || 'straight'}`);
                }
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
  }, [isPaused, simulationSpeed, intersections, isInIntersection]);

  // V2I Broadcasting: Emergency vehicles broadcast their status
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const emergencyVehicles = vehicles.filter(v => v.isEmergency);
      const messages = [];

      emergencyVehicles.forEach(ev => {
        // Calculate which intersections are in range and in path
        const approachingIntersections = [];
        
        intersections.forEach(intersection => {
          const distance = Math.sqrt(
            Math.pow(ev.x - intersection.x, 2) + 
            Math.pow(ev.y - intersection.y, 2)
          );

          // Check if intersection is ahead in vehicle's direction
          const isInPath = 
            (ev.direction === 'NORTH' && intersection.y < ev.y) ||
            (ev.direction === 'SOUTH' && intersection.y > ev.y) ||
            (ev.direction === 'EAST' && intersection.x > ev.x) ||
            (ev.direction === 'WEST' && intersection.x < ev.x);

          if (distance <= 300 && isInPath) {
            approachingIntersections.push({
              id: intersection.id,
              distance: distance
            });
          }
        });

        if (approachingIntersections.length > 0) {
          // Calculate ETA
          const nearestIntersection = approachingIntersections.reduce((nearest, current) => 
            current.distance < nearest.distance ? current : nearest
          );
          const eta = nearestIntersection.distance / (ev.speed * simulationSpeed);

          // Create V2I message
          const v2iMessage = {
            vehicleId: ev.id,
            vehicleType: ev.type,
            position: { x: ev.x, y: ev.y },
            direction: ev.direction,
            speed: ev.speed,
            turnIntention: ev.turnDirection || 'straight',
            urgency: 'HIGH',
            requestingPriority: true,
            estimatedTimeToIntersection: eta,
            approachingIntersections: approachingIntersections.map(i => i.id),
            timestamp: Date.now()
          };

          // Log V2I broadcast
          console.log(`
═══════════════════════════════════════
📡 V2I BROADCAST
═══════════════════════════════════════
Vehicle: ${ev.id.toFixed(2)} (${v2iMessage.vehicleType})
Position: (${Math.round(v2iMessage.position.x)}, ${Math.round(v2iMessage.position.y)})
Direction: ${v2iMessage.direction}
Turn Intention: ${v2iMessage.turnIntention}
Speed: ${v2iMessage.speed}
ETA: ${eta.toFixed(2)}s
Approaching Intersections: ${v2iMessage.approachingIntersections.join(', ')}
═══════════════════════════════════════
          `);

          messages.push(v2iMessage);

          // Send message to each approaching intersection
          approachingIntersections.forEach(({ id, distance }) => {
            const intersection = intersections.find(i => i.id === id);
            if (intersection) {
              // Intersection receives V2I message
              receiveV2IMessage(intersection, v2iMessage, distance);
            }
          });
        }
      });

      setV2iMessages(messages);
      setStatistics(prev => ({
        ...prev,
        v2iBroadcasts: prev.v2iBroadcasts + messages.length
      }));
    }, 200); // Broadcast every 200ms

    return () => clearInterval(interval);
  }, [isPaused, vehicles, intersections, simulationSpeed]);

  // V2I Message Reception: Intersections receive and process messages
  const receiveV2IMessage = useCallback((intersection, message, distance) => {
    console.log(`
───────────────────────────────────────
🚦 INTERSECTION ${intersection.id} - V2I MESSAGE RECEIVED
───────────────────────────────────────
From Vehicle: ${message.vehicleId.toFixed(2)} (${message.vehicleType})
Direction: ${message.direction}
Turn Intention: ${message.turnIntention}
Distance: ${Math.round(distance)}px
ETA: ${message.estimatedTimeToIntersection.toFixed(2)}s
───────────────────────────────────────
    `);

    // Early detection: 200-300px range
    if (distance <= 300 && distance > 50) {
      console.log(`🚨 Intersection ${intersection.id}: Emergency vehicle detected at ${Math.round(distance)}px - ACTIVATING EMERGENCY MODE`);
      
      // Determine which signal to turn green
      let signalToGreen;
      
      // If vehicle is turning, determine target direction
      if (message.turnIntention === 'left') {
        const turnMap = {
          'NORTH': 'west',
          'SOUTH': 'east',
          'EAST': 'north',
          'WEST': 'south'
        };
        signalToGreen = turnMap[message.direction];
      } else if (message.turnIntention === 'right') {
        const turnMap = {
          'NORTH': 'east',
          'SOUTH': 'west',
          'EAST': 'south',
          'WEST': 'north'
        };
        signalToGreen = turnMap[message.direction];
      } else {
        // Going straight
        signalToGreen = message.direction.toLowerCase();
      }

      console.log(`
───────────────────────────────────────
✅ INTERSECTION ${intersection.id} RESPONSE
───────────────────────────────────────
Action: ACTIVATING EMERGENCY MODE
Signal to GREEN: ${signalToGreen.toUpperCase()}
Turn Type: ${message.turnIntention.toUpperCase()}
Status: ${message.turnIntention === 'straight' ? 
  `EMERGENCY: GOING STRAIGHT FROM ${message.direction}` :
  `EMERGENCY: TURNING ${message.turnIntention.toUpperCase()} FROM ${message.direction}`}
───────────────────────────────────────
      `);
    }
  }, []);

  // Emergency vehicle priority system - Indian style independent control
  // BUG #2 FIX: Implement early detection and signal preemption
  useEffect(() => {
    const emergencyVehicles = vehicles.filter(v => v.isEmergency);
    
    if (emergencyVehicles.length === 0) {
      setEmergencyActive(false);
      preemptionLoggedRef.current = new Map();
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

        // BUG #2 FIX: Start preemption at DETECTION_DISTANCE (200px) 
        // Signal should turn green BEFORE vehicle arrives
        if (distance < VEHICLE_CONSTANTS.DETECTION_DISTANCE && distance > VEHICLE_CONSTANTS.PREEMPTION_MIN_DISTANCE) {
          hasEmergencyOverride = true;
          
          // Log preemption once per vehicle per intersection
          if (distance > VEHICLE_CONSTANTS.PREEMPTION_DISTANCE) {
            const logKey = `${ev.id}-${updatedIntersection.id}`;
            if (!preemptionLoggedRef.current.has(logKey)) {
              console.log(`🚦 Emergency vehicle ${ev.type} detected ${distance.toFixed(0)}px from intersection ${updatedIntersection.id} - Starting signal preemption`);
              preemptionLoggedRef.current.set(logKey, true);
            }
          }
          
          // Determine which direction to turn green based on vehicle's current direction
          let targetDirection;
          
          // If vehicle is turning and close to intersection, use the turn target direction
          if (ev.turnDirection && ev.turnDirection !== 'straight' && distance < VEHICLE_CONSTANTS.TURN_DIRECTION_SWITCH_DISTANCE && ev.turnTo) {
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
    v2iMessages,
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
