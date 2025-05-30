// import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Components/Home'
import EpCard from './Components/EpisodesCard';
import './App.css'

function App() {
  // const [count, setCount] = useState(0)

  return (
    <Router>
      <div className="container mx-auto p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/anime/:id" element={<EpCard />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
