import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import '../Css/HomeSearch.css';
import '../Css/HomeExtra.css';

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

const Home = ({ setSearchQuery, setSearchResults, setIsLoading, setError }: HomeProps) => {
  const navigate = useNavigate();
  

  const [localSearchQuery, setLocalSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery('');
    setLocalSearchQuery('');
  }, [setSearchQuery]);

  const searchAnime = async () => {
    if (!localSearchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(localSearchQuery)}&limit=20&order_by=popularity&sort=asc`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data from Jikan API');
      }

      const data: JikanResponse = await response.json();
      setSearchResults(data.data);
      setSearchQuery(localSearchQuery);


      sessionStorage.setItem('searchQuery', localSearchQuery);
      sessionStorage.setItem('searchResults', JSON.stringify(data.data));

      navigate('/search');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };


  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchAnime();
  };

  return (
    <div className="home-container">
      <div className="home-content-wrapper">
        <h1 className="home-title">AniChapter</h1>
        <p className="home-subtitle">Find the chapter you are looking for</p>

        <form onSubmit={handleSubmit} className="home-search-form">
          <div className="home-search-container">
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="Enter anime title to search the database..."
              className="home-search-input"
            />
            <button
              type="submit"
              className="home-search-button"
            >
              SEARCH
            </button>
          </div>
        </form>
      </div>
    </div>
  );

}

export default Home;
