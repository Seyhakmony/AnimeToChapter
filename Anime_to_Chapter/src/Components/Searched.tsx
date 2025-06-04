import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

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

interface SearchResultsProps {
  searchQuery: string;
  searchResults: AnimeResult[];
  isLoading: boolean;
  error: string | null;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: AnimeResult[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const Searched = ({ 
  searchQuery, 
  searchResults, 
  isLoading, 
  error, 
  setSearchQuery, 
  setSearchResults, 
  setIsLoading, 
  setError 
}: SearchResultsProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { searchQuery?: string; preserveResults?: boolean } | null;
  
  // Local state for the search input on this page
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  useEffect(() => {
    // If we have state from navigation (back button), restore the search
    if (state?.preserveResults && state.searchQuery) {
      // If we don't have results (page refresh case), re-fetch them
      if (searchResults.length === 0 && !isLoading) {
        setSearchQuery(state.searchQuery);
        searchAnime(state.searchQuery);
      }
    }
  }, [state]);

  // Update local search query when global search query changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const searchAnime = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20&order_by=popularity&sort=asc`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data from Jikan API');
      }

      const data = await response.json();
      setSearchResults(data.data);
      setSearchQuery(query);
      
      // Store search data in sessionStorage
      sessionStorage.setItem('searchQuery', query);
      sessionStorage.setItem('searchResults', JSON.stringify(data.data));
      
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
    searchAnime(localSearchQuery);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link 
        to="/" 
        className="text-3xl font-bold mb-6 text-center block text-blue-600 hover:text-blue-800 no-underline"
      >
        Anime Search
      </Link>
      
      {/* Add Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Search for another anime..."
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
      
      <div className="mb-4 text-center">
        <p className="text-lg text-gray-700">Search results for: <strong>"{searchQuery}"</strong></p>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}
      
      {/* Results Display as List */}
      {isLoading ? (
        <div className="text-center p-4">Loading...</div>
      ) : searchResults.length > 0 ? (
        <ul className="list-group pt-4">
          {searchResults.map((anime) => (
            <li key={anime.mal_id} className="d-flex p-3 hover:bg-gray-50 list-group-item align-items-center">
            <img
               src={anime.images.jpg.image_url}
               alt={anime.title}
              className="w-16 h-auto object-cover rounded mr-4"
               style={{ width: '7vw', height: '6vh' }}
               onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/api/placeholder/64/96";
              }}
            />
            <div className="d-flex justify-content-between w-100 align-items-center">
              <Link 
                 to={`/anime/${anime.mal_id}`}
                className="text-lg font-medium text-blue-600 hover:underline text-truncate"
                 style={{ marginLeft: '10px', marginRight: '10px' }}
               >
                {anime.title}
              </Link>
              <div className="text-sm text-gray-600 ml-4">
                Episodes: {anime.episodes ?? 'Unknown'}
                <p>{anime.mal_id}</p>
              </div>
            </div>
          </li>
          ))}
        </ul>
      ) : searchQuery && !error ? (
        <div className="text-center p-8 text-gray-500">
          No results found. Try a different search.
        </div>
      ) : null}
       
    </div>
  );
};

export default Searched;