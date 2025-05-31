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
};

interface WikiSearchResponse {
    success: boolean;
    url?: string;
    source?: string;
    error?: string;
}

const EpisodesInformation = () => {
    const { id } = useParams<{ id: string }>();
    const [anime, setAnime] = useState<AnimeDetail | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAiredStates, setShowAiredStates] = useState<{ [key: number]: boolean }>({});
    const [chapters, setChapters] = useState<{ [episodeId: number]: string[] }>({});
    const [foundFandomUrl, setFoundFandomUrl] = useState<string>("");
    const [wikiSubdomain, setWikiSubdomain] = useState<string>("");

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

    // Fix for the useEffect that calls the wiki search API
useEffect(() => {
    const findFandomWiki = async () => {
        if (anime) {
            const animeName = getTitle(anime);
            console.log("Searching for anime:", animeName);
            
            try {
                const response = await fetch('http://localhost:5000/search-anime-wiki', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ 
                        anime_name: animeName,  // This matches what your Flask API expects
                        animeTitle: animeName   // Adding both for compatibility
                    }),
                });

                console.log("Response status:", response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("API Error:", errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data: WikiSearchResponse = await response.json();
                console.log("Wiki search result:", data);

                if (data.success && data.url) {
                    setFoundFandomUrl(data.url);
                    // Extract subdomain from URL for episode linking
                    const subdomain = extractSubdomain(data.url);
                    setWikiSubdomain(subdomain);
                    console.log("Found fandom URL:", data.url);
                    console.log("Extracted subdomain:", subdomain);
                } else {
                    console.log("No fandom wiki found:", data.error);
                    setWikiSubdomain("unknown");
                }

            } catch (err) {
                console.error('Error searching for fandom wiki:', err);
                setWikiSubdomain("unknown");
                
                // Optional: Show user-friendly error message
                if (err instanceof Error) {
                    console.error('Detailed error:', err.message);
                }
            }
        }
    };

    findFandomWiki();
}, [anime]);

    const extractSubdomain = (url: string): string => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const parts = hostname.split('.');
            if (parts.length >= 3 && parts[1] === 'fandom') {
                return parts[0];
            }
        } catch (err) {
            console.error('Error extracting subdomain:', err);
        }
        return "unknown";
    };

    const toggleInfo = (episodeId: number, episodeTitle: string) => {
        const shouldShow = !showAiredStates[episodeId];

        setShowAiredStates((prevState) => ({
            ...prevState,
            [episodeId]: shouldShow,
        }));

        if (shouldShow && wikiSubdomain !== "unknown") {
            handleEpisodeClick(episodeId, wikiSubdomain, episodeTitle);
        }
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

    const formatLink = (subdomain: string, epTitle: string): string => {
        if (!subdomain || !epTitle || subdomain === "unknown") {
            return '';
        }

        const epfTitle = encodeURIComponent(epTitle.trim().replace(/\s+/g, "_"));
        return `https://${subdomain}.fandom.com/wiki/${epfTitle}`;
    };

    const chapterinfo = async (url: string): Promise<string[]> => {
        if (!url) return [];
        
        console.log("Trying URL for chapters:", url);

        try {
            const res = await fetch('http://localhost:5000/getchapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();
            if (Array.isArray(data.chapters)) {
                return data.chapters;
            }
        } catch (err) {
            console.error("Error fetching chapters:", err);
        }

        return [];
    };

    const handleEpisodeClick = async (episodeId: number, subdomain: string, episodeTitle: string) => {
        try {
            const baseUrl = formatLink(subdomain, episodeTitle);
            const urls: string[] = [
                baseUrl, 
                baseUrl + '_(Episode)',
                baseUrl.replace(episodeTitle.replace(/\s+/g, "_"), episodeTitle.replace(/\s+/g, "_") + "_(episode)")
            ];

            for (const url of urls) {
                if (url) {
                    const chapterData = await chapterinfo(url);
                    if (chapterData.length !== 0) {
                        setChapters((prev) => ({
                            ...prev,
                            [episodeId]: chapterData,
                        }));
                        return;
                    }
                }
            }

            setChapters((prev) => ({
                ...prev,
                [episodeId]: ["No chapter information found"],
            }));
        } catch (err) {
            console.error("Failed to fetch episode details:", err);
            setChapters((prev) => ({
                ...prev,
                [episodeId]: ["Error fetching chapter information"],
            }));
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

                    {foundFandomUrl ? (
                        <div className="mt-2">
                            <a 
                                href={foundFandomUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-green-600 hover:underline font-semibold"
                            >
                                ✓ Found Fandom Wiki: {foundFandomUrl}
                            </a>
                        </div>
                    ) : (
                        <div className="mt-2">
                            <span className="text-sm text-orange-600">
                                🔍 Searching for fandom wiki...
                            </span>
                        </div>
                    )}

                    {anime.genres && anime.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2 my-3">
                            {anime.genres.map((genre) => (
                                <span key={genre.mal_id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="d-flex justify-content-center align-items-center">
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
                                                onClick={() => toggleInfo(episode.mal_id, episode.title)}
                                                disabled={!foundFandomUrl}
                                            >
                                                {showAiredStates[episode.mal_id] ? '▲' : '▼'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Episode details */}
                                    {showAiredStates[episode.mal_id] && (
                                        <div className="p-4 bg-gray-50 border-t">
                                            <p><strong>Aired on:</strong> {episode.aired ? formatDate(episode.aired) : 'Unknown Air Date'}</p>
                                            {episode.filler && <p><span className="badge bg-warning text-dark">Filler Episode</span></p>}
                                            {episode.recap && <p><span className="badge bg-info text-dark">Recap Episode</span></p>}
                                            
                                            {wikiSubdomain !== "unknown" && (
                                                <div>
                                                    <a
                                                        href={formatLink(wikiSubdomain, episode.title)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        Fandom Wiki Link: {formatLink(wikiSubdomain, episode.title)}
                                                    </a>

                                                    {chapters[episode.mal_id] && (
                                                        <div className="mt-2">
                                                            <p className="mb-0 fw-semibold text-dark fs-5">
                                                                Chapters:{" "}
                                                                <span className="text-muted">
                                                                    {chapters[episode.mal_id].join(", ")}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {wikiSubdomain === "unknown" && (
                                                <div className="text-orange-600 text-sm">
                                                    No fandom wiki found for this anime
                                                </div>
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