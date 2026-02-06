import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const SimulationContext = createContext();

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

// RoadGrid system for strict lane positioning
class RoadGrid {
  constructor() {
    // Define the intersection positions
    this.intersections = [
      { id: 1, x: 490, y: 290 },
      { id: 2, x: 990, y: 290 },
      { id: 3, x: 490, y: 690 },
      { id: 4, x: 990, y: 690 }
    ];
    
    // Define vertical roads (North-South) - two roads
    // Left vertical road center: x = 470
    // Right vertical road center: x = 970
    this.verticalRoads = [
      { index: 0, centerX: 470 },
      { index: 1, centerX: 970 }
    ];
    
    // Define horizontal roads (East-West) - two roads
    // Top horizontal road center: y = 270
    // Bottom horizontal road center: y = 670
    this.horizontalRoads = [
      { index: 0, centerY: 270 },
      { index: 1, centerY: 670 }
    ];
    
    this.laneWidth = 45;
  }
  
  // Get the X coordinate for a vertical road at specific lane
  getVerticalRoadLaneX(roadIndex, lane, direction) {
    if (roadIndex < 0 || roadIndex >= this.verticalRoads.length) {
      console.error(`Invalid vertical road index: ${roadIndex}`);
      return this.verticalRoads[0].centerX;
    }
    
    const road = this.verticalRoads[roadIndex];
    const roadCenterX = road.centerX;
    
    if (direction === 'NORTH') {
      // North-bound traffic uses right side (west side) of road
      return lane === 1 ? roadCenterX + this.laneWidth/2 : roadCenterX + this.laneWidth * 1.5;
    } else {
      // South-bound traffic uses left side (east side) of road
      return lane === 1 ? roadCenterX - this.laneWidth/2 : roadCenterX - this.laneWidth * 1.5;
    }
  }
  
  // Get the Y coordinate for a horizontal road at specific lane
  getHorizontalRoadLaneY(roadIndex, lane, direction) {
    if (roadIndex < 0 || roadIndex >= this.horizontalRoads.length) {
      console.error(`Invalid horizontal road index: ${roadIndex}`);
      return this.horizontalRoads[0].centerY;
    }
    
    const road = this.horizontalRoads[roadIndex];
    const roadCenterY = road.centerY;
    
    if (direction === 'EAST') {
      // East-bound traffic uses right side (south side) of road
      return lane === 1 ? roadCenterY - this.laneWidth/2 : roadCenterY - this.laneWidth * 1.5;
    } else {
      // West-bound traffic uses left side (north side) of road
      return lane === 1 ? roadCenterY + this.laneWidth/2 : roadCenterY + this.laneWidth * 1.5;
    }
  }
  
  // Find which road index a vehicle should be on after a turn
  findRoadIndexAfterTurn(intersectionId, newDirection) {
    const intersection = this.intersections.find(i => i.id === intersectionId);
    if (!intersection) return 0;
    
    if (newDirection === 'NORTH' || newDirection === 'SOUTH') {
      // Determine which vertical road based on intersection X
      // Intersection at x=490 -> left vertical road (index 0)
      // Intersection at x=990 -> right vertical road (index 1)
      return intersection.x < 750 ? 0 : 1;
    } else {
      // Determine which horizontal road based on intersection Y
      // Intersection at y=290 -> top horizontal road (index 0)
      // Intersection at y=690 -> bottom horizontal road (index 1)
      return intersection.y < 500 ? 0 : 1;
    }
  }
}

// Create global road grid instance
const roadGrid = new RoadGrid();

// Traffic signal phases for standard two-phase system
const SIGNAL_PHASES = {
  GREEN: 'GREEN',
  RED: 'RED'
};

// Signal timing (in milliseconds)
const TIMING = {
  PHASE_DURATION: 30000  // 30 seconds per phase
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
  DESTINATION_REACH_DISTANCE: 5, // Distance to consider destination reached (px)
  V2I_COMMUNICATION_MAX_DISTANCE: 300, // Maximum distance for V2I communication with emergency vehicles (px)
  V2I_COMMUNICATION_MIN_DISTANCE: 10,  // Minimum distance for V2I communication (px)
  V2I_REGULAR_COMMUNICATION_DISTANCE: 80, // V2I communication distance for regular vehicles (px)
  // Off-screen exit coordinates for continued movement after turns
  EXIT_NORTH: -100,             // Y coordinate for vehicles exiting north (off screen top)
  EXIT_SOUTH: 1000,             // Y coordinate for vehicles exiting south (off screen bottom)
  EXIT_EAST: 1600,              // X coordinate for vehicles exiting east (off screen right)
  EXIT_WEST: -100               // X coordinate for vehicles exiting west (off screen left)
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

  // Initialize intersections with standard two-phase system
  useEffect(() => {
    const initialIntersections = [
      { 
        id: 1, 
        x: 490, 
        y: 290, 
        currentPhase: 'north-south',  // Standard two-phase system
        phaseTime: 0,
        phaseDuration: 30000, // 30 seconds per phase
        signals: {
          north: SIGNAL_PHASES.GREEN,
          south: SIGNAL_PHASES.GREEN,
          east: SIGNAL_PHASES.RED,
          west: SIGNAL_PHASES.RED
        },
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
      },
      { 
        id: 2, 
        x: 990, 
        y: 290, 
        currentPhase: 'east-west',  // Start on opposite phase for variety
        phaseTime: 0,
        phaseDuration: 30000,
        signals: {
          north: SIGNAL_PHASES.RED,
          south: SIGNAL_PHASES.RED,
          east: SIGNAL_PHASES.GREEN,
          west: SIGNAL_PHASES.GREEN
        },
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
      },
      { 
        id: 3, 
        x: 490, 
        y: 690, 
        currentPhase: 'north-south',
        phaseTime: 0,
        phaseDuration: 30000,
        signals: {
          north: SIGNAL_PHASES.GREEN,
          south: SIGNAL_PHASES.GREEN,
          east: SIGNAL_PHASES.RED,
          west: SIGNAL_PHASES.RED
        },
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
      },
      { 
        id: 4, 
        x: 990, 
        y: 690, 
        currentPhase: 'east-west',
        phaseTime: 0,
        phaseDuration: 30000,
        signals: {
          north: SIGNAL_PHASES.RED,
          south: SIGNAL_PHASES.RED,
          east: SIGNAL_PHASES.GREEN,
          west: SIGNAL_PHASES.GREEN
        },
        emergencyOverride: false,
        emergencyMode: false,
        activeEmergencyVehicle: null,
        receivedMessages: []
      }
    ];
    setIntersections(initialIntersections);
  }, []);

  // Update traffic signals - Standard two-phase system
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIntersections(prev => prev.map(intersection => {
        if (intersection.emergencyOverride) return intersection;

        // Update phase time
        const newPhaseTime = intersection.phaseTime + (100 * simulationSpeed);

        // Check if it's time to switch phase
        if (newPhaseTime >= intersection.phaseDuration) {
          // Switch phase
          const newPhase = intersection.currentPhase === 'north-south' ? 'east-west' : 'north-south';
          
          let newSignals;
          if (newPhase === 'north-south') {
            // Switch to north-south green
            newSignals = {
              north: SIGNAL_PHASES.GREEN,
              south: SIGNAL_PHASES.GREEN,
              east: SIGNAL_PHASES.RED,
              west: SIGNAL_PHASES.RED
            };
            console.log(`Intersection ${intersection.id}: Switched to NORTH-SOUTH phase`);
          } else {
            // Switch to east-west green
            newSignals = {
              north: SIGNAL_PHASES.RED,
              south: SIGNAL_PHASES.RED,
              east: SIGNAL_PHASES.GREEN,
              west: SIGNAL_PHASES.GREEN
            };
            console.log(`Intersection ${intersection.id}: Switched to EAST-WEST phase`);
          }

          return {
            ...intersection,
            currentPhase: newPhase,
            phaseTime: 0,
            signals: newSignals
          };
        }

        // Just update the timer
        return {
          ...intersection,
          phaseTime: newPhaseTime
        };
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, simulationSpeed]);

  // Helper function to create smooth bezier turn path
  const createTurnPath = useCallback((startPos, endPos, turnType) => {
    // Create a smooth arc using quadratic bezier curve
    const points = [];
    const steps = 30; // Number of points in the arc
    
    // Calculate control point for bezier curve
    let controlPoint;
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    
    if (turnType === 'left') {
      // Control point to the left of the direct line
      controlPoint = {
        x: startPos.x + dx * 0.5 - dy * 0.3,
        y: startPos.y + dy * 0.5 + dx * 0.3
      };
    } else { // right turn
      // Control point to the right of the direct line
      controlPoint = {
        x: startPos.x + dx * 0.5 + dy * 0.3,
        y: startPos.y + dy * 0.5 - dx * 0.3
      };
    }
    
    // Generate bezier curve points
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic bezier formula: B(t) = (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
      const x = Math.pow(1 - t, 2) * startPos.x + 
                2 * (1 - t) * t * controlPoint.x + 
                Math.pow(t, 2) * endPos.x;
      const y = Math.pow(1 - t, 2) * startPos.y + 
                2 * (1 - t) * t * controlPoint.y + 
                Math.pow(t, 2) * endPos.y;
      points.push({ x, y });
    }
    
    return points;
  }, []);

  // Helper function to calculate lane center for strict lane discipline using RoadGrid
  const calculateLanePosition = useCallback((vehicle) => {
    // Return the exact X or Y coordinate where the vehicle should be centered in its lane
    // Using the RoadGrid system for precise positioning
    
    // For vehicles moving straight (not in an intersection turning)
    if (!vehicle.path || vehicle.pathIndex >= vehicle.path.length) {
      // Vehicle is moving straight - enforce strict lane position using RoadGrid
      if (vehicle.direction === 'NORTH' || vehicle.direction === 'SOUTH') {
        // For vertical movement, lock X position to lane using RoadGrid
        const roadIndex = vehicle.currentRoadIndex !== undefined ? vehicle.currentRoadIndex : 0;
        const laneX = roadGrid.getVerticalRoadLaneX(roadIndex, vehicle.lane, vehicle.direction);
        return { lockAxis: 'x', position: laneX };
      } else {
        // For horizontal movement, lock Y position to lane using RoadGrid
        const roadIndex = vehicle.currentRoadIndex !== undefined ? vehicle.currentRoadIndex : 0;
        const laneY = roadGrid.getHorizontalRoadLaneY(roadIndex, vehicle.lane, vehicle.direction);
        return { lockAxis: 'y', position: laneY };
      }
    }
      }
    }
    
    // Vehicle is following a path (likely turning)
    return null; // Allow free movement during turns
  }, []);

  // Helper function to find intersections in path for route planning
  const findIntersectionsInPath = useCallback((vehicle, maxDistance) => {
    const intersectionsInPath = [];
    
    intersections.forEach(intersection => {
      const distance = Math.sqrt(
        Math.pow(intersection.x - vehicle.x, 2) + 
        Math.pow(intersection.y - vehicle.y, 2)
      );

      // Check if intersection is ahead in vehicle's direction
      const isInPath = 
        (vehicle.direction === 'NORTH' && intersection.y < vehicle.y) ||
        (vehicle.direction === 'SOUTH' && intersection.y > vehicle.y) ||
        (vehicle.direction === 'EAST' && intersection.x > vehicle.x) ||
        (vehicle.direction === 'WEST' && intersection.x < vehicle.x);

      if (distance <= maxDistance && isInPath) {
        intersectionsInPath.push({
          intersection: intersection,
          distance: distance
        });
      }
    });

    // Sort by distance (closest first)
    return intersectionsInPath.sort((a, b) => a.distance - b.distance);
  }, [intersections]);

  // Add vehicle with optional turn direction for emergency vehicles
  const addVehicle = useCallback((type = 'car', turnDirection = null) => {
    // 4-lane routes - two lanes per direction with proper spacing
    // Each lane is 50px wide, 8px gap between same direction, 12px gap between opposite directions
    // Scaled for larger grid (1.67x)
    const routes = [
      // Horizontal roads - eastbound (top road, 2 lanes)
      { start: { x: -50, y: 252 }, end: { x: 1550, y: 252 }, direction: 'EAST', lane: 1 }, // Right lane
      { start: { x: -50, y: 244 }, end: { x: 1550, y: 244 }, direction: 'EAST', lane: 2 }, // Left lane
      // Horizontal roads - westbound (top road, 2 lanes)
      { start: { x: 1550, y: 288 }, end: { x: -50, y: 288 }, direction: 'WEST', lane: 1 }, // Right lane
      { start: { x: 1550, y: 296 }, end: { x: -50, y: 296 }, direction: 'WEST', lane: 2 }, // Left lane
      // Horizontal roads - eastbound (bottom road, 2 lanes)
      { start: { x: -50, y: 652 }, end: { x: 1550, y: 652 }, direction: 'EAST', lane: 1 },
      { start: { x: -50, y: 644 }, end: { x: 1550, y: 644 }, direction: 'EAST', lane: 2 },
      // Horizontal roads - westbound (bottom road, 2 lanes)
      { start: { x: 1550, y: 688 }, end: { x: -50, y: 688 }, direction: 'WEST', lane: 1 },
      { start: { x: 1550, y: 696 }, end: { x: -50, y: 696 }, direction: 'WEST', lane: 2 },
      // Vertical roads - southbound (left road, 2 lanes)
      { start: { x: 452, y: -50 }, end: { x: 452, y: 950 }, direction: 'SOUTH', lane: 1 },
      { start: { x: 444, y: -50 }, end: { x: 444, y: 950 }, direction: 'SOUTH', lane: 2 },
      // Vertical roads - northbound (left road, 2 lanes)
      { start: { x: 488, y: 950 }, end: { x: 488, y: -50 }, direction: 'NORTH', lane: 1 },
      { start: { x: 496, y: 950 }, end: { x: 496, y: -50 }, direction: 'NORTH', lane: 2 },
      // Vertical roads - southbound (right road, 2 lanes)
      { start: { x: 952, y: -50 }, end: { x: 952, y: 950 }, direction: 'SOUTH', lane: 1 },
      { start: { x: 944, y: -50 }, end: { x: 944, y: 950 }, direction: 'SOUTH', lane: 2 },
      // Vertical roads - northbound (right road, 2 lanes)
      { start: { x: 988, y: 950 }, end: { x: 988, y: -50 }, direction: 'NORTH', lane: 1 },
      { start: { x: 996, y: 950 }, end: { x: 996, y: -50 }, direction: 'NORTH', lane: 2 }
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
    // Scaled for larger grid
    const emergencyTurnRoutes = {
      'right': [
        // NORTH approach turning RIGHT (clockwise) → EAST
        { start: { x: 488, y: 950 }, waypoint: { x: 488, y: 290 }, end: { x: 1550, y: 252 }, direction: 'NORTH', turnAt: { x: 490, y: 290 }, turnTo: 'EAST' },
        // EAST approach turning RIGHT (clockwise) → SOUTH
        { start: { x: -50, y: 252 }, waypoint: { x: 490, y: 252 }, end: { x: 452, y: 950 }, direction: 'EAST', turnAt: { x: 490, y: 290 }, turnTo: 'SOUTH' },
        // SOUTH approach turning RIGHT (clockwise) → WEST
        { start: { x: 452, y: -50 }, waypoint: { x: 452, y: 290 }, end: { x: -50, y: 288 }, direction: 'SOUTH', turnAt: { x: 490, y: 290 }, turnTo: 'WEST' },
        // WEST approach turning RIGHT (clockwise) → NORTH
        { start: { x: 1550, y: 288 }, waypoint: { x: 490, y: 288 }, end: { x: 488, y: -50 }, direction: 'WEST', turnAt: { x: 490, y: 290 }, turnTo: 'NORTH' }
      ],
      'left': [
        // NORTH approach turning LEFT (counter-clockwise) → WEST
        { start: { x: 488, y: 950 }, waypoint: { x: 488, y: 290 }, end: { x: -50, y: 288 }, direction: 'NORTH', turnAt: { x: 490, y: 290 }, turnTo: 'WEST' },
        // EAST approach turning LEFT (counter-clockwise) → NORTH
        { start: { x: -50, y: 252 }, waypoint: { x: 490, y: 252 }, end: { x: 488, y: -50 }, direction: 'EAST', turnAt: { x: 490, y: 290 }, turnTo: 'NORTH' },
        // SOUTH approach turning LEFT (counter-clockwise) → EAST
        { start: { x: 452, y: -50 }, waypoint: { x: 452, y: 290 }, end: { x: 1550, y: 252 }, direction: 'SOUTH', turnAt: { x: 490, y: 290 }, turnTo: 'EAST' },
        // WEST approach turning LEFT (counter-clockwise) → SOUTH
        { start: { x: 1550, y: 288 }, waypoint: { x: 490, y: 288 }, end: { x: 452, y: 950 }, direction: 'WEST', turnAt: { x: 490, y: 290 }, turnTo: 'SOUTH' }
      ]
    };

    let selectedRoute = route;
    let path = null;
    
    // Only apply turn routes for actual turns (not straight)
    if (isEmergency && turnDirection && turnDirection !== 'straight' && emergencyTurnRoutes[turnDirection]) {
      const turnRoutes = emergencyTurnRoutes[turnDirection];
      const turnRoute = turnRoutes[Math.floor(Math.random() * turnRoutes.length)];
      selectedRoute = turnRoute;
      
      // CRITICAL FIX #6: Generate smooth turn path using bezier curves
      // Instead of just 3 waypoints, create a smooth arc through the intersection
      const turnStart = { x: turnRoute.waypoint.x, y: turnRoute.waypoint.y };
      const turnEnd = { x: turnRoute.end.x, y: turnRoute.end.y };
      const smoothTurnPath = createTurnPath(turnStart, turnEnd, turnDirection);
      
      path = [
        { x: turnRoute.start.x, y: turnRoute.start.y },
        ...smoothTurnPath  // Add all the smooth curve points
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
      lane: selectedRoute.lane || 1,
      plannedTurnIntersectionId: null, // Will be set by route planning
      // Store initial lane positions for strict lane discipline
      startLaneX: selectedRoute.start.x,
      startLaneY: selectedRoute.start.y,
      // Track current road index for RoadGrid positioning
      currentRoadIndex: 0, // Will be calculated based on spawn position
      onVerticalRoad: selectedRoute.direction === 'NORTH' || selectedRoute.direction === 'SOUTH'
    };
    
    // Calculate initial road index based on spawn position
    if (newVehicle.onVerticalRoad) {
      // Determine which vertical road - left (0) or right (1)
      newVehicle.currentRoadIndex = newVehicle.x < 750 ? 0 : 1;
    } else {
      // Determine which horizontal road - top (0) or bottom (1)
      newVehicle.currentRoadIndex = newVehicle.y < 500 ? 0 : 1;
    }

    // Route planning for emergency vehicles - determine which intersection to turn at
    if (isEmergency && turnDirection && turnDirection !== 'straight') {
      // findIntersectionsInPath only reads x, y, and direction properties
      const intersectionsInPath = findIntersectionsInPath(newVehicle, 1000);
      
      if (intersectionsInPath.length >= 2) {
        // Plan to turn at 2nd intersection if available
        newVehicle.plannedTurnIntersectionId = intersectionsInPath[1].intersection.id;
        console.log(`🚑 Route Planning: Will turn ${turnDirection.toUpperCase()} at intersection ${newVehicle.plannedTurnIntersectionId} (2nd in path, ${Math.round(intersectionsInPath[1].distance)}px away)`);
      } else if (intersectionsInPath.length >= 1) {
        // Otherwise turn at 1st intersection
        newVehicle.plannedTurnIntersectionId = intersectionsInPath[0].intersection.id;
        console.log(`🚑 Route Planning: Will turn ${turnDirection.toUpperCase()} at intersection ${newVehicle.plannedTurnIntersectionId} (1st in path, ${Math.round(intersectionsInPath[0].distance)}px away)`);
      }
    }

    // Debug logging for emergency vehicles
    if (isEmergency) {
      const boxWidth = 44;
      const padText = (text, label = '') => {
        const fullText = label ? `${label}: ${text}` : text;
        return fullText.padEnd(boxWidth - 4);
      };
      
      console.log(`╔════════════════════════════════════════════╗`);
      console.log(`║ EMERGENCY VEHICLE SPAWNED                  ║`);
      console.log(`╠════════════════════════════════════════════╣`);
      console.log(`║ ${padText(newVehicle.id.toFixed(2), 'ID')} ║`);
      console.log(`║ ${padText(type, 'Type')} ║`);
      console.log(`║ ${padText((turnDirection || 'straight').toUpperCase(), 'Turn Direction')} ║`);
      console.log(`║ ${padText(`(${selectedRoute.start.x}, ${selectedRoute.start.y})`, 'Spawn Position')} ║`);
      console.log(`║ ${padText(selectedRoute.direction, 'Spawn Direction')} ║`);
      if (newVehicle.plannedTurnIntersectionId) {
        console.log(`║ ${padText(`Intersection ${newVehicle.plannedTurnIntersectionId}`, 'Planned Turn At')} ║`);
      }
      console.log(`╚════════════════════════════════════════════╝`);
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
  }, [setVehicles, setStatistics, setEmergencyActive, findIntersectionsInPath, createTurnPath]);

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
                  // Stop if signal is red (simplified for two-phase system)
                  shouldStop = signal === SIGNAL_PHASES.RED;
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
              let newX = vehicle.x + Math.cos(angle) * reducedSpeed;
              let newY = vehicle.y + Math.sin(angle) * reducedSpeed;
              
              // CRITICAL FIX #4: Enforce lane discipline even when following
              const lanePosition = calculateLanePosition(vehicle);
              if (lanePosition) {
                if (lanePosition.lockAxis === 'x') {
                  newX = lanePosition.position;
                } else if (lanePosition.lockAxis === 'y') {
                  newY = lanePosition.position;
                }
              }
              
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
                
                // CRITICAL FIX #6: Check if we're at the last waypoint of the turn
                // The direction changes when we complete the turn arc
                const isLastWaypoint = (nextIndex === vehicle.path.length - 1);
                if (vehicle.turnTo && isLastWaypoint) {
                  // CRITICAL FIX: Only execute turn if we're at the planned turn intersection
                  // Check which intersection we're at or passed through
                  let currentIntersectionId = null;
                  intersections.forEach(intersection => {
                    const distToInt = Math.sqrt(
                      Math.pow(vehicle.x - intersection.x, 2) + 
                      Math.pow(vehicle.y - intersection.y, 2)
                    );
                    // If we're within or just past the intersection
                    if (distToInt < 150) {
                      currentIntersectionId = intersection.id;
                    }
                  });
                  
                  // Only execute turn if this is the planned turn intersection
                  if (currentIntersectionId === vehicle.plannedTurnIntersectionId) {
                    // This is the turn completion point - update to new direction
                    newDirection = vehicle.turnTo;
                    // Debug logging for turn execution
                    if (vehicle.isEmergency) {
                      const boxWidth = 44;
                      const padText = (text, label = '') => {
                        const fullText = label ? `${label}: ${text}` : text;
                        return fullText.padEnd(boxWidth - 4);
                      };
                      
                      console.log(`╔════════════════════════════════════════════╗`);
                      console.log(`║ TURN COMPLETED AT INTERSECTION             ║`);
                      console.log(`╠════════════════════════════════════════════╣`);
                      console.log(`║ ${padText(vehicle.id.toFixed(2), 'Vehicle ID')} ║`);
                      console.log(`║ ${padText(vehicle.type, 'Type')} ║`);
                      console.log(`║ ${padText(currentIntersectionId.toString(), 'Intersection')} ║`);
                      console.log(`║ ${padText((vehicle.turnDirection || 'straight').toUpperCase(), 'Stated Turn')} ║`);
                      console.log(`║ ${padText(`${vehicle.direction} → ${newDirection}`, 'Direction')} ║`);
                      console.log(`╚════════════════════════════════════════════╝`);
                    }
                  } else if (vehicle.isEmergency && currentIntersectionId) {
                    // Vehicle has turn path but this is not the planned intersection
                    console.log(`🚑 ${vehicle.type} ID ${vehicle.id.toFixed(2)} near intersection ${currentIntersectionId}, but planned turn is at ${vehicle.plannedTurnIntersectionId}`);
                  }
                }
                return {
                  ...vehicle,
                  targetX: nextWaypoint.x,
                  targetY: nextWaypoint.y,
                  direction: newDirection,
                  pathIndex: nextIndex,
                  // Update lane positions when direction changes
                  startLaneX: newDirection === 'NORTH' || newDirection === 'SOUTH' ? nextWaypoint.x : vehicle.startLaneX,
                  startLaneY: newDirection === 'EAST' || newDirection === 'WEST' ? nextWaypoint.y : vehicle.startLaneY,
                  status: vehicle.turnDirection ? `turning ${vehicle.turnDirection}` : 'moving'
                };
              } else {
                // Reached final waypoint - transition from path-following to straight-line movement
                // CRITICAL: Determine the new road index and lock to proper lane
                
                // Find which intersection we just passed through
                let passedIntersectionId = null;
                intersections.forEach(intersection => {
                  const distToInt = Math.sqrt(
                    Math.pow(vehicle.x - intersection.x, 2) + 
                    Math.pow(vehicle.y - intersection.y, 2)
                  );
                  if (distToInt < 150) {
                    passedIntersectionId = intersection.id;
                  }
                });
                
                // Calculate new road index based on new direction and intersection
                const newRoadIndex = roadGrid.findRoadIndexAfterTurn(passedIntersectionId || 1, vehicle.direction);
                const newOnVerticalRoad = (vehicle.direction === 'NORTH' || vehicle.direction === 'SOUTH');
                
                // Lock vehicle to proper lane on new road using RoadGrid
                let correctedX = vehicle.x;
                let correctedY = vehicle.y;
                
                if (newOnVerticalRoad) {
                  correctedX = roadGrid.getVerticalRoadLaneX(newRoadIndex, vehicle.lane, vehicle.direction);
                } else {
                  correctedY = roadGrid.getHorizontalRoadLaneY(newRoadIndex, vehicle.lane, vehicle.direction);
                }
                
                if (vehicle.isEmergency) {
                  console.log(`
╔════════════════════════════════════════════╗
║ TURN COMPLETE                              ║
╠════════════════════════════════════════════╣
║ Vehicle: ${vehicle.id.toFixed(2).padEnd(37)} ║
║ New Direction: ${vehicle.direction.padEnd(30)} ║
║ New Road Index: ${newRoadIndex.toString().padEnd(29)} ║
║ Position Before: (${Math.round(vehicle.x)}, ${Math.round(vehicle.y)})${('').padEnd(21 - Math.round(vehicle.x).toString().length - Math.round(vehicle.y).toString().length)} ║
║ Position After:  (${Math.round(correctedX)}, ${Math.round(correctedY)})${('').padEnd(21 - Math.round(correctedX).toString().length - Math.round(correctedY).toString().length)} ║
║ ✓ Locked to lane on new road              ║
╚════════════════════════════════════════════╝
                  `);
                }
                
                // Calculate a far-away target in the new direction to continue movement
                let newTargetX, newTargetY;
                switch(vehicle.direction) {
                  case 'NORTH':
                    newTargetX = correctedX;
                    newTargetY = VEHICLE_CONSTANTS.EXIT_NORTH;
                    break;
                  case 'SOUTH':
                    newTargetX = correctedX;
                    newTargetY = VEHICLE_CONSTANTS.EXIT_SOUTH;
                    break;
                  case 'EAST':
                    newTargetX = VEHICLE_CONSTANTS.EXIT_EAST;
                    newTargetY = correctedY;
                    break;
                  case 'WEST':
                    newTargetX = VEHICLE_CONSTANTS.EXIT_WEST;
                    newTargetY = correctedY;
                    break;
                  default:
                    newTargetX = vehicle.targetX;
                    newTargetY = vehicle.targetY;
                }
                
                // Clear the path and set up for straight-line movement
                return {
                  ...vehicle,
                  x: correctedX,
                  y: correctedY,
                  path: null,
                  pathIndex: null,
                  targetX: newTargetX,
                  targetY: newTargetY,
                  currentRoadIndex: newRoadIndex,
                  onVerticalRoad: newOnVerticalRoad,
                  // Lock to the RoadGrid lane position based on new direction
                  startLaneX: newOnVerticalRoad ? correctedX : vehicle.startLaneX,
                  startLaneY: !newOnVerticalRoad ? correctedY : vehicle.startLaneY,
                  status: 'moving'
                };
              }
            }
          }

          // Move vehicle
          const speed = vehicle.speed * simulationSpeed;
          const angle = Math.atan2(dy, dx);
          let newX = vehicle.x + Math.cos(angle) * speed;
          let newY = vehicle.y + Math.sin(angle) * speed;

          // CRITICAL FIX #4: Enforce strict lane discipline
          // Vehicles must stay centered in their lane unless turning at intersection
          const lanePosition = calculateLanePosition(vehicle);
          if (lanePosition) {
            if (lanePosition.lockAxis === 'x') {
              // Lock X position for vertical roads (North/South movement)
              newX = lanePosition.position;
              // Only Y changes
            } else if (lanePosition.lockAxis === 'y') {
              // Lock Y position for horizontal roads (East/West movement)
              newY = lanePosition.position;
              // Only X changes
            }
          }

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
  }, [isPaused, simulationSpeed, intersections, isInIntersection, calculateLanePosition]);

  // V2I Message Reception: Intersections receive and process messages
  const receiveV2IMessage = useCallback((intersection, message, distance) => {
    console.log(`
───────────────────────────────────────
🚦 INTERSECTION ${intersection.id} - V2I MESSAGE RECEIVED
───────────────────────────────────────
From Vehicle: ${message.vehicleId.toFixed(2)} (${message.vehicleType})
Direction: ${message.direction}
Turn Intention (overall): ${message.turnIntention}
Action at THIS intersection: ${message.actionAtThisIntersection}
Distance: ${Math.round(distance)}px
ETA: ${message.estimatedTimeToIntersection.toFixed(2)}s
───────────────────────────────────────
    `);

    // Early detection: 200-300px range
    if (distance <= 300 && distance > 50) {
      console.log(`🚨 Intersection ${intersection.id}: Emergency vehicle detected at ${Math.round(distance)}px - ACTIVATING EMERGENCY MODE`);
      
      // Determine which signal to turn green based on action at THIS intersection
      let signalToGreen;
      const action = message.actionAtThisIntersection; // 'straight', 'left', or 'right'
      
      // If vehicle is turning at THIS intersection, determine target direction
      if (action === 'left') {
        const turnMap = {
          'NORTH': 'west',
          'SOUTH': 'east',
          'EAST': 'north',
          'WEST': 'south'
        };
        signalToGreen = turnMap[message.direction];
      } else if (action === 'right') {
        const turnMap = {
          'NORTH': 'east',
          'SOUTH': 'west',
          'EAST': 'south',
          'WEST': 'north'
        };
        signalToGreen = turnMap[message.direction];
      } else {
        // Going straight through THIS intersection
        signalToGreen = message.direction.toLowerCase();
      }

      console.log(`
───────────────────────────────────────
✅ INTERSECTION ${intersection.id} RESPONSE
───────────────────────────────────────
Action: ACTIVATING EMERGENCY MODE
Signal to GREEN: ${signalToGreen.toUpperCase()}
Action Type: ${action.toUpperCase()}
Status: ${action === 'straight' ? 
  `EMERGENCY: GOING STRAIGHT FROM ${message.direction}` :
  `EMERGENCY: TURNING ${action.toUpperCase()} FROM ${message.direction}`}
───────────────────────────────────────
      `);
    }
  }, []);

  // V2I Broadcasting: Emergency vehicles broadcast their status
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const emergencyVehicles = vehicles.filter(v => v.isEmergency);
      const messages = [];

      emergencyVehicles.forEach(ev => {
        // Find intersections in path, sorted by distance
        const intersectionsInPath = findIntersectionsInPath(ev, 500);
        
        if (intersectionsInPath.length === 0) return;
        
        // Get the IMMEDIATE next intersection (closest one)
        const nextIntersection = intersectionsInPath[0];
        const distanceToNext = nextIntersection.distance;
        
        // Only communicate with immediate next intersection when in range
        if (distanceToNext <= VEHICLE_CONSTANTS.V2I_COMMUNICATION_MAX_DISTANCE && distanceToNext > VEHICLE_CONSTANTS.V2I_COMMUNICATION_MIN_DISTANCE) {
          // Determine if we're turning at THIS intersection or going straight
          let actionAtThisIntersection = 'straight';
          
          if (ev.plannedTurnIntersectionId === nextIntersection.intersection.id) {
            // This is where we turn
            actionAtThisIntersection = ev.turnDirection || 'straight';
          }
          
          // Calculate ETA
          const eta = distanceToNext / (ev.speed * simulationSpeed);

          // Create V2I message
          const v2iMessage = {
            vehicleId: ev.id,
            vehicleType: ev.type,
            position: { x: ev.x, y: ev.y },
            direction: ev.direction,
            speed: ev.speed,
            turnIntention: ev.turnDirection || 'straight',
            actionAtThisIntersection: actionAtThisIntersection, // What vehicle will do at THIS intersection
            urgency: 'HIGH',
            requestingPriority: true,
            estimatedTimeToIntersection: eta,
            targetIntersectionId: nextIntersection.intersection.id,
            distanceToIntersection: distanceToNext,
            timestamp: Date.now()
          };

          // Log V2I broadcast
          console.log(`
╔═══════════════════════════════════════════════════════════╗
║ 📡 V2I BROADCAST                                          ║
╠═══════════════════════════════════════════════════════════╣
║ Vehicle: ${ev.id.toFixed(2)} (${v2iMessage.vehicleType})`.padEnd(60) + '║');
          console.log(`║ Position: (${Math.round(v2iMessage.position.x)}, ${Math.round(v2iMessage.position.y)})`.padEnd(60) + '║');
          console.log(`║ Direction: ${v2iMessage.direction}`.padEnd(60) + '║');
          console.log(`║ Overall Turn Intention: ${v2iMessage.turnIntention.toUpperCase()}`.padEnd(60) + '║');
          console.log(`║ Action at Intersection ${nextIntersection.intersection.id}: ${actionAtThisIntersection.toUpperCase()}`.padEnd(60) + '║');
          console.log(`║ Distance to intersection: ${Math.round(distanceToNext)}px`.padEnd(60) + '║');
          console.log(`║ ETA: ${eta.toFixed(2)}s`.padEnd(60) + '║');
          console.log(`╚═══════════════════════════════════════════════════════════╝`);

          messages.push(v2iMessage);

          // Send message to ONLY the immediate next intersection
          receiveV2IMessage(nextIntersection.intersection, v2iMessage, distanceToNext);
        }
      });

      setV2iMessages(messages);
      setStatistics(prev => ({
        ...prev,
        v2iBroadcasts: prev.v2iBroadcasts + messages.length
      }));
    }, 200); // Broadcast every 200ms

    return () => clearInterval(interval);
  }, [isPaused, vehicles, simulationSpeed, receiveV2IMessage, findIntersectionsInPath]);

  // Emergency vehicle priority system - Standard two-phase with proper signaling
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

    // Set signals to green for emergency vehicle - Standard two-phase behavior
    setIntersections(prev => prev.map(intersection => {
      let updatedIntersection = { ...intersection };
      let hasEmergencyOverride = false;
      
      emergencyVehicles.forEach(ev => {
        const distance = Math.sqrt(
          Math.pow(ev.x - updatedIntersection.x, 2) + 
          Math.pow(ev.y - updatedIntersection.y, 2)
        );

        // Check if this is the intersection ahead in path
        const isInPath = 
          (ev.direction === 'NORTH' && updatedIntersection.y < ev.y) ||
          (ev.direction === 'SOUTH' && updatedIntersection.y > ev.y) ||
          (ev.direction === 'EAST' && updatedIntersection.x > ev.x) ||
          (ev.direction === 'WEST' && updatedIntersection.x < ev.x);

        // Start preemption at DETECTION_DISTANCE (200px)
        if (isInPath && distance < VEHICLE_CONSTANTS.DETECTION_DISTANCE && distance > VEHICLE_CONSTANTS.PREEMPTION_MIN_DISTANCE) {
          hasEmergencyOverride = true;
          
          // Log preemption once per vehicle per intersection
          if (distance > VEHICLE_CONSTANTS.PREEMPTION_DISTANCE) {
            const logKey = `${ev.id}-${updatedIntersection.id}`;
            if (!preemptionLoggedRef.current.has(logKey)) {
              console.log(`🚦 Emergency vehicle ${ev.type} detected ${distance.toFixed(0)}px from intersection ${updatedIntersection.id} - Starting signal preemption`);
              preemptionLoggedRef.current.set(logKey, true);
            }
          }
          
          // Determine the approach direction
          const approachDirection = ev.direction;
          
          // Set emergency signals based on two-phase system
          let newSignals;
          if (approachDirection === 'NORTH' || approachDirection === 'SOUTH') {
            // Give green to north-south phase
            newSignals = {
              north: SIGNAL_PHASES.GREEN,
              south: SIGNAL_PHASES.GREEN,
              east: SIGNAL_PHASES.RED,
              west: SIGNAL_PHASES.RED
            };
            console.log(`
═══════════════════════════════════════════════════
EMERGENCY PRIORITY ACTIVATED
═══════════════════════════════════════════════════
Intersection: ${updatedIntersection.id}
Emergency Vehicle: ${ev.id.toFixed(2)}
Direction: ${approachDirection}
Turn: ${ev.turnDirection}
Phase: NORTH-SOUTH GREEN
═══════════════════════════════════════════════════
            `);
          } else {
            // Give green to east-west phase
            newSignals = {
              north: SIGNAL_PHASES.RED,
              south: SIGNAL_PHASES.RED,
              east: SIGNAL_PHASES.GREEN,
              west: SIGNAL_PHASES.GREEN
            };
            console.log(`
═══════════════════════════════════════════════════
EMERGENCY PRIORITY ACTIVATED
═══════════════════════════════════════════════════
Intersection: ${updatedIntersection.id}
Emergency Vehicle: ${ev.id.toFixed(2)}
Direction: ${approachDirection}
Turn: ${ev.turnDirection}
Phase: EAST-WEST GREEN
═══════════════════════════════════════════════════
            `);
          }
          
          updatedIntersection = {
            ...updatedIntersection,
            emergencyOverride: true,
            signals: newSignals,
            emergencyTurnDirection: ev.turnDirection
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
        // For emergency vehicles, show only to immediate next intersection
        if (v1.isEmergency) {
          const intersectionsInPath = findIntersectionsInPath(v1, 500);
          if (intersectionsInPath.length > 0) {
            const nextIntersection = intersectionsInPath[0];
            const distance = nextIntersection.distance;
            
            if (distance <= VEHICLE_CONSTANTS.V2I_COMMUNICATION_MAX_DISTANCE && distance > VEHICLE_CONSTANTS.V2I_COMMUNICATION_MIN_DISTANCE) {
              links.push({
                type: 'V2I',
                from: { x: v1.x, y: v1.y },
                to: { x: nextIntersection.intersection.x, y: nextIntersection.intersection.y }
              });
            }
          }
        } else {
          // For regular vehicles, show to nearby intersections
          intersections.forEach(intersection => {
            const distance = Math.sqrt(
              Math.pow(v1.x - intersection.x, 2) + 
              Math.pow(v1.y - intersection.y, 2)
            );
            
            if (distance < VEHICLE_CONSTANTS.V2I_REGULAR_COMMUNICATION_DISTANCE) {
              links.push({
                type: 'V2I',
                from: { x: v1.x, y: v1.y },
                to: { x: intersection.x, y: intersection.y }
              });
            }
          });
        }
      });

      setCommunicationLinks(links);
      setStatistics(prev => ({ 
        ...prev, 
        communicationMessages: links.length 
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [vehicles, intersections, isPaused, findIntersectionsInPath]);

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
