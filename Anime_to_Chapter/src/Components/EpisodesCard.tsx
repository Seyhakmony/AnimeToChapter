import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';


interface AnimeDetail {
    mal_id: number;
    titles: Title[];
    title_english: string | null;
    title_japanese: string | null;
    images: {
        jpg: {
            large_image_url: string;
        };
        webp: {
            large_image_url: string;
        };
    };
    trailer: {
        youtube_id: string | null;
        url: string | null;
    };
    synopsis: string | null;
    background: string | null;
    status: string;
    season: string | null;
    year: number | null;
    episodes: number | null;
    duration: string;
    rating: string;
    score: number | null;
    scored_by: number | null;
    rank: number | null;
    popularity: number | null;
    genres: {
        mal_id: number;
        type: string;
        name: string;
    }[];
    aired: {
        from: string | null;
        to: string | null;
    };
}

interface Episode {
    mal_id: number;
    title: string;
    episode: string;
    aired: string | null;
    filler: boolean;
    recap: boolean;
    forum_url: string | null;
}

interface JikanAnimeResponse {
    data: AnimeDetail;
}

interface JikanEpisodesResponse {
    data: Episode[];
    pagination: {
        last_visible_page: number;
        has_next_page: boolean;
    };
}

type Title = {
    type: string;
    title: string;
    wikiUrl?: string;
};



const EpisodesInformation = () => {
    const { id } = useParams<{ id: string }>();
    const [anime, setAnime] = useState<AnimeDetail | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAiredStates, setShowAiredStates] = useState<{ [key: number]: boolean }>({});

    const [validatedTitles, setValidatedTitles] = useState<string>("");
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Fetch anime details
                const animeResponse = await fetch(`https://api.jikan.moe/v4/anime/${id}`);
                if (!animeResponse.ok) {
                    throw new Error('Failed to fetch anime details');
                }
                const animeData: JikanAnimeResponse = await animeResponse.json();
                setAnime(animeData.data);
                

                // Wait for 1 second to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Fetch episodes
                const episodesResponse = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes`);
                if (!episodesResponse.ok) {
                    throw new Error('Failed to fetch episodes');
                }
                const episodesData: JikanEpisodesResponse = await episodesResponse.json();
                setEpisodes(episodesData.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);


   useEffect(() => {
        const validateTitles = async () => {
            if (anime?.titles) {
                const result = await getAllTitles(anime.titles);
                setValidatedTitles(result);
            } else {
                setValidatedTitles("Unknown Title");
            }
        };

        validateTitles();
    }, [anime?.titles]);



    const toggleInfo = (episodeId: number) => {
        setShowAiredStates((prevState) => ({
            ...prevState,
            [episodeId]: !prevState[episodeId],
        }));
    };

    // format link
    const formatLink = (animeT: string, epTitle: string): string => {
        if (!animeT || !epTitle) {
            return '';
        }

        // Fandom uses lowercase with dashes or underscores for subdomains in most cases
        const fTitle = animeT.toLowerCase().replace(/[\s:!']/g, "").replace(/[^a-z0-9]/g, "");
        const epfTitle = encodeURIComponent(epTitle.trim().replace(/\s+/g, "_"));

        return `https://${fTitle}.fandom.com/wiki/${epfTitle}`;
    };


    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

   const getTitle = (anime: AnimeDetail | null) => {
        if (!anime) return 'Unknown Anime';
        return anime.title_english || anime.titles.find(t => t.type === 'English')?.title || anime.title_japanese || 'Unknown Anime';
    };


const getAllTitles = async (titles: Title[] | null): Promise<string> => {
  console.log("getAllTitles called with:", titles);

  if (!titles) return "Unknown Title";

  const validTitles = await Promise.all(
    titles.map(async (t) => {
      const isValid = await finalTitle(t.title);
      console.log(t.title);
      return isValid ? getSubUrl(t.title) : null;
    })
  );

  return validTitles.filter((t): t is string => t !== null).join(', ');
};

const getSubUrl = (title: string): string => {
    const cleanedTitle = title.replace(/\s+\d+(st|nd|rd|th)?\s+Season/i, '').trim();
    const subdomain = cleanedTitle
        .toLowerCase()
        .replace(/[\s_]/g, '')
        .replace(/[^a-z0-9]/g, '');
    return subdomain;
};

const formalU = (title: string): string => {

    const cleanedTitle = title.replace(/\s+\d+(st|nd|rd|th)?\s+Season/i, '').trim();
    const subdomain = cleanedTitle
        .toLowerCase()
        .replace(/[\s_]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const wikiPath = cleanedTitle.replace(/\s+/g, '_') + "_Wiki";

    return `https://${subdomain}.fandom.com/wiki/${wikiPath}`;
};


const finalTitle = async (title: string): Promise<boolean> => {
  try {
    
    const url = formalU(title);
   
    const res = await fetch('http://localhost:5000/checkurl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    
    return data.found === true;
  } catch (err) {
    console.error('Error checking title:', err);
    return false;
  }
};



    if (isLoading) {
        return <div className="text-center p-8">Loading...</div>;
    }

    if (error) {
        return (
            <div className="p-4 bg-red-100 text-red-700 rounded">
                <p>Error: {error}</p>
                <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
                    Back to Search
                </Link>
            </div>
        );
    }

    if (!anime) {
        return (
            <div className="text-center p-8">
                <p className="mb-4">Anime not found</p>
                <Link to="/" className="text-blue-600 hover:underline">
                    Back to Search
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Search
            </Link>

            <div className="bg-white rounded-lg shadow overflow-hidden">

                <div className="p-6 md:flex pt-4">
                    <h1 className="text-2xl md:text-3xl font-bold">{getTitle(anime)}</h1>
                    <h2 className="text-lg md:text-xl font-semibold">
                        {validatedTitles}
                    </h2>

                    {anime.genres && anime.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2 my-3">
                            {anime.genres.map((genre) => (
                                <span key={genre.mal_id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="d-flex  justify-content-center align-items-center">
                        <div className="md:w-1/3 flex-shrink-0 mb-4 md:mb-0 px-5">
                            <img
                                src={anime.images.jpg.large_image_url}
                                alt={getTitle(anime)}
                                className="w-40 max-w-xs mx-auto rounded shadow"
                                style={{
                                    width: '15vw',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    minWidth: '50px',
                                    minHeight: '75px',
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "/api/placeholder/225/350";
                                }}
                            />
                        </div>
                        <div className="md:ml-6 md:w-2/3">






                            <div className="grid md:grid-cols-2 gap-4 my-4 px-5">
                                <div>
                                    <p><span className="font-semibold">Status:</span> {anime.status || 'Unknown'}</p>
                                    <p><span className="font-semibold">Episodes:</span> {anime.episodes || 'Unknown'}</p>
                                    <p><span className="font-semibold">Rating:</span> {anime.rating || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p><span className="font-semibold">Season:</span> {anime.season && anime.year ? `${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)} ${anime.year}` : 'Unknown'}</p>
                                    <p><span className="font-semibold">Score:</span> {anime.score ? `${anime.score} (${anime.scored_by?.toLocaleString()} votes)` : 'N/A'}</p>
                                    <p><span className="font-semibold">Rank:</span> {anime.rank ? `#${anime.rank}` : 'N/A'}</p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <p><span className="font-semibold">Aired:</span> {formatDate(anime.aired.from)} to {anime.aired.to ? formatDate(anime.aired.to) : 'Present'}</p>
                            </div>
                        </div>

                    </div>
                </div>
                {anime.synopsis && (
                    <div className="mt-4 px-5">
                        <h3 className="text-lg font-semibold mb-2">Summary</h3>
                        <p className="text-gray-700">{anime.synopsis}</p>
                    </div>
                )}

                {/* Episodes List */}
                <div className="p-6 border-t">
                    <h2 className="text-xl font-bold mb-4">Episodes</h2>

                    {episodes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {episodes.map((episode, index) => (
                                <div key={episode.mal_id} className="border rounded overflow-hidden shadow-sm hover:shadow transition-shadow">
                                    <div className="p-4 d-flex align-items-center justify-content-between">

                                        <div className="d-flex align-items-center" style={{ gap: '10px', minWidth: '50%' }}>
                                            <div className="d-flex align-items-center" style={{ gap: '10px' }}>
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs text-center" style={{ width: '30px' }}>
                                                    {index + 1}
                                                </span>
                                                <div style={{ width: '1px', height: '24px', backgroundColor: 'black' }}></div>
                                            </div>

                                            <h3 className="font-medium text-lg m-0 text-truncate">{episode.title}</h3>
                                        </div>

                                        <div className="d-flex align-items-center" style={{ gap: '10px', minWidth: '180px', justifyContent: 'flex-end' }}>
                                            {episode.aired && (
                                                <p className="text-sm text-gray-600 mb-0 px-3">
                                                    Released: {formatDate(episode.aired)}
                                                </p>
                                            )}

                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => toggleInfo(episode.mal_id)}
                                            >
                                                {showAiredStates[episode.mal_id] ? '▲' : '▼'}
                                            </button>
                                        </div>
                                    </div>



                                    {/* Main scrape */}
                                    {showAiredStates[episode.mal_id] && (
                                        <div className="p-4 bg-gray-50 border-t">
                                            <p><strong>Aired on:</strong> {episode.aired ? formatDate(episode.aired) : 'Unknown Air Date'}</p>
                                            {episode.filler && <p><span className="badge bg-warning text-dark">Filler Episode</span></p>}
                                            {episode.recap && <p><span className="badge bg-info text-dark">Recap Episode</span></p>}
                                            {episode.forum_url && (
                                                <p>
                                                    <a href={formatLink(validatedTitles, episode.title)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                        FandomWiki Link
                                                        {formatLink(validatedTitles, episode.title)}
                                                    </a>
                                                </p>
                                            )}
                                        </div>
                                    )}



                                </div>
                            ))}
                        </div>
                    ) : anime.episodes ? (
                        <div className="bg-gray-50 p-4 rounded">
                            <p>This anime has {anime.episodes} episode{anime.episodes !== 1 ? 's' : ''}, but detailed episode information is not available.</p>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded">
                            <p>No episode information available for this anime.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


export default EpisodesInformation;