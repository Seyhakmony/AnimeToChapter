import { Link } from 'react-router-dom';

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
}

const Searched = ({ searchQuery, searchResults, isLoading, error }: SearchResultsProps) => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <Link 
        to="/" 
        className="text-3xl font-bold mb-6 text-center block text-blue-600 hover:text-blue-800 no-underline"
      >
        Anime Search
      </Link>
      
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