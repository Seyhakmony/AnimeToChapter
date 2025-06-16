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

      <div className="step-guide-container">
        <h2 className="step-guide-title">How It Works</h2>
        <div className="step-guide-wrapper">
          
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-content">
              <div className="step-image">
                <img src = "pic/phase1.webp" alt="Search for anime" />
              </div>
              <h3 className="step-title">Search for an Anime</h3>
              <p className="step-description">
                  Enter the title of any anime series to discover its corresponding manga chapters. 
              </p>
            </div>
          </div>



          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-content">
              <div className="step-image">
                <img src="pic/phase2.webp" alt="Browse results" />
              </div>
              <h3 className="step-title">Browse Results</h3>
              <p className="step-description">
                Browse through search results and select the exact anime series you're interested in.
              </p>
            </div>
          </div>


          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-content">
              <div className="step-image">
                <img src="pic/phase3.webp" alt="Find chapters" />
              </div>
              <h3 className="step-title">Find the Manga Chapter for a Specific Episode</h3>
              <p className="step-description">
                Look up specific episodes and discover their corresponding manga chapters, complete with fandom wiki links and detailed episode information.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
 
}

export default Home;