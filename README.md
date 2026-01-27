# V2I System Demonstration

A comprehensive React-based Vehicle-to-Infrastructure (V2I) system that demonstrates intelligent transportation concepts including vehicle-to-vehicle (V2V) communication, traffic signal coordination, emergency vehicle prioritization, and advanced features like vehicle queue management and emergency vehicle turning.

![V2I System](https://img.shields.io/badge/React-18.2.0-blue)
![Status](https://img.shields.io/badge/Status-Active-success)

## 🌟 Features

### Core Features
- **Real-time Vehicle Simulation**: Multiple vehicle types with realistic movement and behavior
- **Traffic Intersection Management**: 4 intelligent intersections with automatic signal cycling
- **V2V Communication**: Vehicle-to-Vehicle communication with visual indicators
- **V2I Communication**: Vehicle-to-Infrastructure data exchange
- **Emergency Vehicle Priority**: Automatic signal override for emergency vehicles with turning capability
- **Interactive Controls**: Full control over simulation parameters and vehicle spawning
- **4-Lane Road System**: Realistic 4-lane roads with proper lane markings and discipline
- **Vehicle Queue Management**: Intelligent collision detection and safe spacing between vehicles

### Vehicle Types
- 🚗 **Regular Cars**: Standard passenger vehicles (blue top-view)
- 🚌 **Buses**: Public transportation vehicles (orange top-view, slower speed)
- 🚚 **Trucks**: Commercial freight vehicles (brown top-view)
- 🚑 **Emergency Vehicles**: Ambulances with priority routing (white with red cross, flashing lights)

### Traffic Management
- **4-Way Traffic Control**: Each intersection manages North, South, East, and West traffic
- **Automatic Signal Cycling**: Red → Yellow → Green transitions with realistic timing
- **Emergency Override**: Signals turn green for emergency vehicle paths
- **Smart Vehicle Detection**: Vehicles detect and respond to traffic signals
- **Queue Management**: Vehicles maintain safe following distances (40px minimum)
- **Collision Detection**: Prevents vehicles from overlapping or colliding

### Communication Systems
- **V2V (Vehicle-to-Vehicle)**: 
  - Proximity-based communication between nearby vehicles
  - Visual connection lines (cyan color)
  - Collision avoidance and information sharing
  
- **V2I (Vehicle-to-Infrastructure)**:
  - Communication between vehicles and traffic signals
  - Visual connection lines (orange color)
  - Real-time data exchange and coordination
  - Turn signal communication for emergency vehicles

### Emergency Vehicle Priority System
- 🚨 **Automatic Detection**: System detects approaching emergency vehicles
- 🟢 **Signal Override**: Traffic lights turn green in emergency vehicle's path
- 🔴 **Cross-Traffic Control**: Perpendicular signals turn red to clear the path
- 🎯 **Priority Corridor**: Maintains clear path until emergency vehicle passes
- ↩️ **Normal Restoration**: Automatic return to normal operation after clearance
- **Turning Capability**: Emergency vehicles can turn right or left at intersections
  - Turn intentions displayed with arrow indicators (➡️ ⬅️)
  - V2I communication shows "EMERGENCY TURNING RIGHT/LEFT"
  - Traffic signals adjust for turn direction

### 4-Lane Road System
- **Dual Lanes Per Direction**: 2 lanes for each travel direction
- **Lane Markings**: 
  - Yellow solid center divider separating opposite directions
  - White dashed lines between lanes
  - Asphalt gray road surface (#4a4a5e)
- **Lane Discipline**:
  - Regular vehicles primarily use right lane (Lane 1) - 70%
  - Faster vehicles and passing use left lane (Lane 2) - 30%
  - Emergency vehicles use whichever lane provides clearest path
- **Realistic Speeds**: Buses (1.5x), Cars (2.0x), Emergency (4.0x)

### Top-View Vehicle Design
All vehicles use CSS-based top-view representations:
- **Cars**: Blue rectangles with windshield details
- **Buses**: Orange rectangles with window sections
- **Trucks**: Brown rectangles with cab and cargo distinction
- **Ambulances**: White with red border, red cross symbol, and flashing red lights
- **Proper Orientation**: Vehicles rotate correctly (N:0°, E:90°, S:180°, W:270°)

## 🚀 Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YashasJKumar/V2I-System.git
   cd V2I-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## 🎮 How to Use

### Control Panel
Located on the right side of the screen:

1. **Simulation Controls**
   - ⏸️/▶️ **Pause/Resume**: Control simulation flow
   - 🎬 **Start Demo**: Automatic demonstration mode
   - **Speed Slider**: Adjust simulation speed (0.5x to 3x)

2. **Add Vehicles**
   - **🚗 Add Car**: Spawn regular passenger car
   - **🚌 Add Bus**: Spawn bus (slower speed)
   - **🚚 Add Truck**: Spawn commercial truck
   - **🚑 Emergency (Straight)**: Spawn emergency vehicle going straight
   - **🚑 Emergency ➡️ Right**: Spawn emergency vehicle that will turn right
   - **🚑 Emergency ⬅️ Left**: Spawn emergency vehicle that will turn left

3. **Statistics Panel**
   - Monitor active vehicles
   - Track emergency events
   - View communication link count
   - See emergency status in real-time

### Legend
Located on the left side of the screen:
- Shows all vehicle types and their icons
- Explains traffic signal colors
- Displays communication line types
- Lists status indicators

### Simulation Area
The main central area displays:
- 4 intersections in a grid layout
- Moving vehicles on defined paths
- Traffic signals at each intersection
- Communication links between entities
- Real-time status updates

## 🏗️ Project Structure

```
V2I-System/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Intersection.js        # Traffic intersection component
│   │   ├── Vehicle.js             # Vehicle rendering component
│   │   ├── CommunicationLinks.js  # V2V/V2I visualization
│   │   ├── ControlPanel.js        # User controls
│   │   ├── Legend.js              # Information legend
│   │   └── SimulationArea.js      # Main simulation container
│   ├── contexts/
│   │   └── SimulationContext.js   # Global state management
│   ├── styles/
│   │   ├── index.css              # Global styles
│   │   ├── App.css                # App component styles
│   │   ├── Intersection.css       # Intersection styles
│   │   ├── Vehicle.css            # Vehicle styles
│   │   ├── CommunicationLinks.css # Communication styles
│   │   ├── ControlPanel.css       # Control panel styles
│   │   ├── Legend.css             # Legend styles
│   │   └── SimulationArea.css     # Simulation area styles
│   ├── App.js                     # Main App component
│   └── index.js                   # Entry point
├── package.json
└── README.md
```

## 🔧 Technical Implementation

### Technologies Used
- **React 18.2.0**: UI library with hooks
- **React Context API**: State management
- **CSS3**: Styling and animations
- **SVG**: Communication link visualization
- **JavaScript ES6+**: Modern JavaScript features

### Key Concepts

#### State Management
Uses React Context API for global state:
- Vehicle tracking and movement
- Intersection signal states
- Communication links
- Statistics and emergency status

#### Component Architecture
- **Modular Design**: Each component handles specific functionality
- **Reusable Components**: Intersection and Vehicle components are reusable
- **Separation of Concerns**: Logic separated from presentation

#### Animation System
- **CSS Transitions**: Smooth vehicle movement
- **React State Updates**: 50ms intervals for position updates
- **Traffic Signal Timing**: Realistic green/yellow/red cycles

#### Communication Simulation
- **Proximity Detection**: Calculates distances between entities
- **Visual Feedback**: SVG lines show active connections
- **Real-time Updates**: 500ms refresh rate

## 📋 Features Checklist

- ✅ React-based web application
- ✅ Real-time vehicle tracking
- ✅ Grid-based intersection system (4 junctions)
- ✅ React hooks (useState, useEffect, useContext)
- ✅ Component-based architecture
- ✅ Realistic traffic signals (Red, Yellow, Green)
- ✅ Automatic traffic light cycling
- ✅ 4-way traffic control per intersection
- ✅ Multiple vehicle types (cars, buses, trucks, emergency)
- ✅ Top-view CSS-based vehicle representations
- ✅ Distinct vehicle visual representations with proper orientation
- ✅ Vehicle movement along defined paths
- ✅ Vehicles stop at red lights
- ✅ Smooth vehicle animations
- ✅ Vehicle queue management with collision detection
- ✅ Safe following distance (40px minimum)
- ✅ Deceleration when approaching vehicles
- ✅ V2V communication with visual indicators
- ✅ V2I communication with visual indicators
- ✅ Emergency vehicle detection
- ✅ Automatic signal override for emergencies
- ✅ Cross-traffic control during emergency
- ✅ Visual priority indicators
- ✅ Priority corridor maintenance
- ✅ Return to normal after emergency passes
- ✅ Emergency vehicle turning (right, left, straight)
- ✅ Turn signal indicators on emergency vehicles
- ✅ V2I turn communication display
- ✅ 4-lane road system with proper markings
- ✅ Yellow center divider
- ✅ White dashed lane markers
- ✅ Lane discipline (70% right lane, 30% left lane)
- ✅ Variable vehicle speeds based on type
- ✅ Clean, modern UI design
- ✅ Color-coded system
- ✅ Legend/key for symbols
- ✅ Intersection status display
- ✅ Add/remove vehicles controls
- ✅ Emergency vehicle spawn with turn options
- ✅ Simulation speed control
- ✅ Pause/resume functionality
- ✅ Real-time statistics
- ✅ Demo mode
- ✅ Responsive design
- ✅ Performance optimized
- ✅ Code documentation

## 🎯 Success Criteria Met

✅ Vehicles never overlap or collide  
✅ Proper queue spacing maintained at all times (40px safe distance)  
✅ Vehicles stop properly at red lights and intersections  
✅ Emergency vehicles can turn right and left  
✅ V2I communication shown for emergency turns  
✅ All vehicles use top-view icons correctly oriented  
✅ 4-lane roads with proper markings throughout  
✅ Vehicles stay in lanes and follow lane discipline  
✅ Emergency priority works for turns, not just straight paths  
✅ Emergency vehicles trigger immediate signal changes  
✅ All cross-traffic stops when emergency vehicle has priority  
✅ V2V and V2I communication is clearly visible  
✅ System runs smoothly with multiple vehicles  
✅ User can interact with and control the simulation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Author

**Yashas J Kumar**

## 🙏 Acknowledgments

- Built with React
- Inspired by real-world intelligent transportation systems
- Demonstrates modern V2V and V2I communication concepts

---

**Note**: This is a demonstration/educational project showcasing V2I system concepts. It's not intended for real-world traffic management use.
