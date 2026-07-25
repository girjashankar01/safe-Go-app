import { Routes, Route } from 'react-router-dom';
import LiveTrackingView from './views/LiveTrackingView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<div style={{ padding: '2rem', textAlign: 'center' }}><h2>SafeGo Dashboard</h2></div>} />
      <Route path="/track/:token" element={<LiveTrackingView />} />
    </Routes>
  );
}

export default App;
