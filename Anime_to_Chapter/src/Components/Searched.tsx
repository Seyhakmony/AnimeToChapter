import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';


import '../Css/HomeSearch.css';

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
  // const navigate = useNavigate();
  const state = location.state as { searchQuery?: string; preserveResults?: boolean } | null;

  
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  useEffect(() => {
    
    if (state?.preserveResults && state.searchQuery) {
      
      if (searchResults.length === 0 && !isLoading) {
        setSearchQuery(state.searchQuery);
        searchAnime(state.searchQuery);
      }
    }
  }, [state]);

useEffect(() => {
    
    const savedQuery = sessionStorage.getItem('searchQuery');
    if (savedQuery) {
        setSearchQuery(savedQuery);
    } else {
        setSearchQuery('');
    }
}, [setSearchQuery]);


  const searchAnime = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20&order_by=popularity&sort=asc&type=tv`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data from Jikan API');
      }

      const data = await response.json();
      setSearchResults(data.data);
      setSearchQuery(query);


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
    <div className="search-container">
      <div className="search-content-wrapper">
        <div className="search-header">
          <Link to="/" className="search-logo-link">
            AniChapter
          </Link>

          <form onSubmit={handleSubmit} className="search-form-container">
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="Search for another anime..."
              className="search-input"
            />
            <button type="submit" className="search-button">
              Search
            </button>
          </form>
        </div>

        <div className="search-results-info">
          <p className="search-results-text">
            Search results for: <span className="search-query-highlight">"{searchQuery}"</span>
          </p>
        </div>

        {error && (
          <div className="search-error">
            Error: {error}
          </div>
        )}

        {isLoading ? (
          <div className="search-loading">Scanning database...</div>
        ) : searchResults.length > 0 ? (
          <ul className="search-results-list">
            {searchResults.map((anime) => (
              <li key={anime.mal_id} className="search-result-item">
                <img
                  src={anime.images.jpg.image_url}
                  alt={anime.title}
                  className="search-result-image"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/api/placeholder/80/120";
                  }}
                />
                <div className="search-result-content">
                  <Link
                    to={`/anime/${anime.mal_id}`}
                    className="search-result-title-link"
                  >
                    {anime.title}
                  </Link>
                  <div className="search-result-meta">
                    <div className="search-result-episodes">
                      Episodes: {anime.episodes ?? 'Unknown'}
                    </div>
                    <p className="search-result-id">{anime.mal_id}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : searchQuery && !error ? (
          <div className="search-no-results">
            No results found in the database. Try a different search query.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Searched;