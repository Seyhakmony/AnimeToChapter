import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

interface JikanResponse {
  data: AnimeResult[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

interface HomeProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: AnimeResult[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const Home = ({ searchQuery, setSearchQuery, setSearchResults, setIsLoading, setError }: HomeProps) => {
  const navigate = useNavigate();

  // Function to search for anime
  const searchAnime = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=20&order_by=popularity&sort=asc`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch data from Jikan API');
      }
      
      const data: JikanResponse = await response.json();
      setSearchResults(data.data);
      navigate('/search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchAnime();
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Anime Search</h1>
      
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for an anime..."
            className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );

}

export default Home;