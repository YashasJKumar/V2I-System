import React from 'react';
import { SimulationProvider } from './contexts/SimulationContext';
import SimulationArea from './components/SimulationArea';
import ControlPanel from './components/ControlPanel';
import './styles/App.css';

function App() {
  return (
    <SimulationProvider>
      <div className="App">
        <header className="app-header">
          <h1>V2I Smart Traffic System</h1>
          <p>Vehicle-to-Infrastructure Communication System</p>
        </header>
        
        <ControlPanel />
        <SimulationArea />
        
        <footer className="app-footer">
          <p>
            <strong>Features:</strong> Real-time V2V & V2I Communication | 
            Emergency Vehicle Priority | Intelligent Traffic Management
          </p>
        </footer>
      </div>
    </SimulationProvider>
  );
}

export default App;
