import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Components/Home'
import SearchResults from './Components/Searched'
import EpCard from './Components/EpisodeInformation';
import './App.css'

// Define TypeScript interfaces
interface AnimeResult {
  mal_id: number;
  title: string;
  images: {
    jpg: {
      image_url: string;
    };
  };
  episodes: number | null;
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add this useEffect to restore data from sessionStorage
  useEffect(() => {
    const savedQuery = sessionStorage.getItem('searchQuery');
    const savedResults = sessionStorage.getItem('searchResults');
    
    if (savedQuery && savedResults) {
      setSearchQuery(savedQuery);
      try {
        const parsedResults = JSON.parse(savedResults);
        setSearchResults(parsedResults);
      } catch (err) {
        console.error('Error parsing saved search results:', err);
      }
    }
  }, []);

  return (
    <Router>
      <div className="container mx-auto p-4">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setSearchResults={setSearchResults}
                setIsLoading={setIsLoading}
                setError={setError}
              />
            }
          />
          <Route
            path="/search"
            element={
              <SearchResults
                searchQuery={searchQuery}
                searchResults={searchResults}
                isLoading={isLoading}
                error={error}
                setSearchQuery={setSearchQuery}
                setSearchResults={setSearchResults}
                setIsLoading={setIsLoading}
                setError={setError}
              />
            }
          />
          <Route
            path="/anime/:id"
            element={
              <EpCard
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setSearchResults={setSearchResults}
                setIsLoading={setIsLoading}
                setError={setError}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App