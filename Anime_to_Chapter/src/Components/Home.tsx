// import { useState } from 'react';
// import { Link } from 'react-router-dom';

// // Define TypeScript interfaces for our data
// interface AnimeResult {
//   id: number;
//   title: {
//     english: string;
//     romaji: string;
//     native: string;
//   };
//   coverImage: {
//     medium: string;
//   };
//   episodes: number;
// }

// interface AniListResponse {
//   data: {
//     Page: {
//       media: AnimeResult[];
//       pageInfo: {
//         total: number;
//         hasNextPage: boolean;
//       };
//     };
//   };
// }

// const Home = () => {
//   const [searchQuery, setSearchQuery] = useState('');
//   const [searchResults, setSearchResults] = useState<AnimeResult[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // Function to search for anime using AniList GraphQL API
//   const searchAnime = async () => {
//     if (!searchQuery.trim()) return;
    
//     setIsLoading(true);
//     setError(null);
    
//     const query = `
//       query ($search: String) {
//         Page(page: 1, perPage: 20) {
//           pageInfo {
//             total
//             hasNextPage
//           }
//           media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
//             id
//             title {
//               english
//               romaji
//               native
//             }
//             coverImage {
//               medium
//             }
//             episodes
//           }
//         }
//       }
//     `;

//     const variables = {
//       search: searchQuery
//     };
    
//     try {
//       const response = await fetch('https://graphql.anilist.co', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Accept': 'application/json',
//         },
//         body: JSON.stringify({
//           query,
//           variables
//         })
//       });
      
//       if (!response.ok) {
//         throw new Error('Failed to fetch data from AniList API');
//       }
      
//       const data: AniListResponse = await response.json();
//       setSearchResults(data.data.Page.media);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'An unknown error occurred');
//       setSearchResults([]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Handle form submission
//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     searchAnime();
//   };

//   // Helper function to get the best available title
//   const getTitle = (title: AnimeResult['title']) => {
//     return title.english || title.romaji || title.native || 'Unknown Title';
//   };

//   return (
//     <div className="container my-4">
//       <h1 className="text-3xl font-bold mb-6 text-center">Anime Search</h1>
      
//       {/* Search Form */}
//       <form onSubmit={handleSubmit} className="mb-8">
//         <div className="d-flex gap-2">
//           <input
//             type="text"
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             placeholder="Search for an anime..."
//             className="form-control flex-grow-1"
//           />
//           <button 
//             type="submit" 
//             className="btn btn-primary"
//             disabled={isLoading}
//           >
//             {isLoading ? 'Searching...' : 'Search'}
//           </button>
//         </div>
//       </form>
      
//       {/* Error Message */}
//       {error && (
//         <div className="p-4 mb-4 bg-danger text-white rounded">
//           Error: {error}
//         </div>
//       )}
      
//       {/* Results Display as List */}
//       {isLoading ? (
//   <div className="text-center p-4">Loading...</div>
// ) : searchResults.length > 0 ? (
//   <div className="list-group">
//     {searchResults.map((anime) => (
//       <div key={anime.id} className="list-group-item d-flex align-items-center">
//         <img
//           src={anime.coverImage.medium}
//           alt={getTitle(anime.title)}
//           style={{ width: '64px', height: '96px', objectFit: 'cover' }}
//           className="me-3"
//           onError={(e) => {
//             const target = e.target as HTMLImageElement;
//             target.src = "/api/placeholder/64/96";
//           }}
//         />
//         <div className="flex-grow-1">
//           <Link 
//             to={`/anime/${anime.id}`}
//             className="h5 mb-0 text-decoration-none text-primary"
//           >
//             {getTitle(anime.title)}
//           </Link>
//         </div>
//         <div className="ms-3 text-muted">
//           Episodes: {anime.episodes || 'Unknown'}
//         </div>
//       </div>
//     ))}
//   </div>
// ) : searchQuery && !error ? (
//   <div className="text-center p-4 text-muted">
//     No results found. Try a different search.
//   </div>
// ) : null}
//     </div>
//   );
// };

// export default Home;

import { useState } from 'react';
import { Link } from 'react-router-dom';

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

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
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

}

export default Home;