import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';



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

interface EpisodesInformationProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setSearchResults: (results: AnimeResult[]) => void;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

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

interface EpisodeSearchResponse {
    success: boolean;
    url?: string;
    episode_number?: string;
    episode_title?: string;
    error?: string;
    tried_urls?: string[];
    fallback_message?: string;
    anime_series_links?: Array<{
        title: string;
        url: string;
    }>;
    method?: string;
}

interface EpisodeContentResponse {
    success: boolean;
    url?: string;
    chapters?: string[];
    html?: string;
    error?: string;
}

const EpisodesInformation = ({ searchQuery, setSearchQuery, setSearchResults, setIsLoading: setGlobalIsLoading, setError: setGlobalError }: EpisodesInformationProps) => {
    const { id } = useParams<{ id: string }>();
    const [anime, setAnime] = useState<AnimeDetail | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAiredStates, setShowAiredStates] = useState<{ [key: number]: boolean }>({});
    const [chapters, setChapters] = useState<{ [episodeId: number]: string[] }>({});
    const [successfulUrls, setSuccessfulUrls] = useState<{ [episodeId: number]: string }>({});
    const [foundFandomUrl, setFoundFandomUrl] = useState<string>("");
    const [wikiSubdomain, setWikiSubdomain] = useState<string>("");
    const [fallbackData, setFallbackData] = useState<{ [episodeId: number]: { message: string, links: Array<{ title: string, url: string }> } }>({});

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const animeResponse = await fetch(`https://api.jikan.moe/v4/anime/${id}`);
                if (!animeResponse.ok) {
                    throw new Error('Failed to fetch anime details');
                }
                const animeData: JikanAnimeResponse = await animeResponse.json();
                setAnime(animeData.data);

                await new Promise(resolve => setTimeout(resolve, 1000));

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

    //searching anime
    const navigate = useNavigate();

    // Function to search for anime
    const searchAnime = async () => {
        if (!searchQuery.trim()) return;

        setGlobalIsLoading(true);
        setGlobalError(null);

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
            setGlobalError(err instanceof Error ? err.message : 'An unknown error occurred');
            setSearchResults([]);
        } finally {
            setGlobalIsLoading(false);
        }
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        searchAnime();
    };

    useEffect(() => {
        const getAllAnimeTitles = (anime: AnimeDetail | null): string[] => {
            if (!anime) return [];

            const titles: string[] = [];

            if (anime.title_english) titles.push(anime.title_english);

            const englishTitle = anime.titles.find(t => t.type === 'English')?.title;
            if (englishTitle && !titles.includes(englishTitle)) titles.push(englishTitle);

            const defaultTitle = anime.titles.find(t => t.type === 'Default')?.title;
            if (defaultTitle && !titles.includes(defaultTitle)) titles.push(defaultTitle);

            if (anime.title_japanese && !titles.includes(anime.title_japanese)) titles.push(anime.title_japanese);

            anime.titles
                .filter(t => t.type === 'Synonym')
                .forEach(t => {
                    if (t.title && !titles.includes(t.title)) titles.push(t.title);
                });

            anime.titles
                .filter(t => !['English', 'Default', 'Synonym', 'Japanese'].includes(t.type))
                .forEach(t => {
                    if (t.title && !titles.includes(t.title)) titles.push(t.title);
                });

            return titles.filter(title => title && title.trim().length > 0);
        };

        const searchWikiWithTitle = async (animeName: string): Promise<WikiSearchResponse> => {
            try {
                const response = await fetch('http://localhost:5000/search-anime-wiki', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ anime_name: animeName }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                return await response.json();
            } catch (err) {
                console.error(`Error searching with title "${animeName}":`, err);
                return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        };

        const findFandomWiki = async () => {
            if (anime) {
                const allTitles = getAllAnimeTitles(anime);

                for (let i = 0; i < allTitles.length; i++) {
                    const currentTitle = allTitles[i];

                    try {
                        const data = await searchWikiWithTitle(currentTitle);

                        if (data.success && data.url && data.url.trim() !== '') {
                            setFoundFandomUrl(data.url);
                            const subdomain = extractSubdomain(data.url);
                            setWikiSubdomain(subdomain);
                            return;
                        }

                        if (i < allTitles.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }

                    } catch (err) {
                        console.error(`Error searching with title "${currentTitle}":`, err);
                        continue;
                    }
                }

                console.log('No valid Fandom wiki found for any of the titles');
                setWikiSubdomain("unknown");
            }
        };

        findFandomWiki();
    }, [anime]);

    const getTitle = (anime: AnimeDetail | null): string => {
        if (!anime) return 'Anime image';
        return (
            anime.title_english ||
            anime.titles.find(t => t.type === 'English')?.title ||
            anime.titles[0]?.title ||
            'Anime image'
        );
    };

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

    const toggleInfo = (episodeId: number, episodeTitle: string, episodeNumber: string) => {
        const shouldShow = !showAiredStates[episodeId];
        setShowAiredStates((prev) => ({ ...prev, [episodeId]: shouldShow }));

        if (shouldShow && wikiSubdomain !== "unknown") {
            handleEpisodeClick(episodeId, wikiSubdomain, episodeTitle, episodeNumber);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const findEpisodePage = async (subdomain: string, episodeTitle: string, episodeNumber: string): Promise<{ url: string | null, fallbackData?: { message: string, links: Array<{ title: string, url: string }> } }> => {
        try {
            console.log(`Searching for episode page: ${episodeNumber} - "${episodeTitle}" in ${subdomain}.fandom.com`);

            const response = await fetch('http://localhost:5000/search-episode-page', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    subdomain: subdomain,
                    episode_title: episodeTitle,
                    episode_number: episodeNumber
                }),
            });

            const data: EpisodeSearchResponse = await response.json();

            if (response.ok && data.success && data.url) {
                console.log(`Found episode page: ${data.url}`);
                return { url: data.url };
            } else if (response.status === 404 && data.anime_series_links) {
                console.log(`No episode found, but got anime series links:`, data.anime_series_links);
                console.log(`Fallback message: ${data.fallback_message}`);

                return {
                    url: null,
                    fallbackData: {
                        message: data.fallback_message || "Chapter scrape couldn't be done, please look for it below:",
                        links: data.anime_series_links
                    }
                };
            } else {
                console.log(`No episode page found: ${data.error}`);
                return { url: null };
            }
        } catch (err) {
            console.error(`Error searching for episode page:`, err);
            return { url: null };
        }
    };

    const getEpisodeContent = async (url: string): Promise<string[]> => {
        if (!url) return [];

        try {
            console.log(`Fetching episode content from: ${url}`);

            const response = await fetch('http://localhost:5000/get-episode-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                console.error(`Episode content fetch failed with status: ${response.status}`);
                return [];
            }

            const data: EpisodeContentResponse = await response.json();

            if (data.success && data.chapters) {
                console.log(`Found chapters:`, data.chapters);
                return data.chapters;
            } else {
                console.log(`No chapters found: ${data.error}`);
                return [];
            }
        } catch (err) {
            console.error(`Error fetching episode content:`, err);
            if (err instanceof TypeError && err.message === 'Failed to fetch') {
                console.error('This might be a CORS issue or the backend server (localhost:5000) might not be running');
            }
            return [];
        }
    };

    const handleEpisodeClick = async (
        episodeId: number,
        subdomain: string,
        episodeTitle: string,
        episodeNumber: string
    ) => {
        if (successfulUrls[episodeId]) {
            const cachedUrl = successfulUrls[episodeId];
            const chaptersData = await getEpisodeContent(cachedUrl);
            setChapters((prev) => ({ ...prev, [episodeId]: chaptersData }));
            return;
        }

        const result = await findEpisodePage(subdomain, episodeTitle, episodeNumber);

        if (result.url) {
            setSuccessfulUrls((prev) => ({ ...prev, [episodeId]: result.url! }));
            const chaptersData = await getEpisodeContent(result.url);
            setChapters((prev) => ({ ...prev, [episodeId]: chaptersData }));
        } else if (result.fallbackData) {
            setFallbackData((prev) => ({ ...prev, [episodeId]: result.fallbackData! }));
            setSuccessfulUrls((prev) => ({ ...prev, [episodeId]: '' }));
            setChapters((prev) => ({ ...prev, [episodeId]: [] }));
        } else {
            setSuccessfulUrls((prev) => ({ ...prev, [episodeId]: '' }));
            setChapters((prev) => ({ ...prev, [episodeId]: [] }));
        }
    };

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f0c29 0%, #24243e 50%, #302b63 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{
                    color: '#00ffff',
                    fontSize: '24px',
                    textShadow: '0 0 20px #00ffff',
                    animation: 'pulse 2s infinite'
                }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Link
                    to="/"
                    style={{
                        color: '#00ffff',
                        textDecoration: 'none',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        textShadow: '0 0 10px #00ffff',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.textShadow = '0 0 20px #00ffff';
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                    }}
                >
                    Anime Search
                </Link>

                {/* Search Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for another anime..."
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 255, 255, 0.3)',
                            background: 'rgba(36, 36, 62, 0.8)',
                            color: '#ffffff',
                            fontSize: '14px',
                            minWidth: '250px'
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            background: 'linear-gradient(45deg, #ff0080, #00ffff)',
                            color: '#000',
                            border: 'none',
                            padding: '8px 15px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        Search
                    </button>
                </form>
            </div>
        );
    }

    if (!anime) {
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Link
                    to="/"
                    style={{
                        color: '#00ffff',
                        textDecoration: 'none',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        textShadow: '0 0 10px #00ffff',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.textShadow = '0 0 20px #00ffff';
                    }}
                    onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                    }}
                >
                    Anime Search
                </Link>

                {/* Search Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for another anime..."
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 255, 255, 0.3)',
                            background: 'rgba(36, 36, 62, 0.8)',
                            color: '#ffffff',
                            fontSize: '14px',
                            minWidth: '250px'
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            background: 'linear-gradient(45deg, #ff0080, #00ffff)',
                            color: '#000',
                            border: 'none',
                            padding: '8px 15px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        Search
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0c29 0%, #24243e 50%, #302b63 100%)',
            color: '#ffffff',
            padding: '20px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header with logo and search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <Link
                        to="/"
                        style={{
                            color: '#00ffff',
                            textDecoration: 'none',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            textShadow: '0 0 10px #00ffff',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.textShadow = '0 0 20px #00ffff';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                        }}
                    >
                        Anime Search
                    </Link>

                    {/* Search Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for another anime..."
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 255, 255, 0.3)',
                                background: 'rgba(36, 36, 62, 0.8)',
                                color: '#ffffff',
                                fontSize: '14px',
                                minWidth: '250px'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                background: 'linear-gradient(45deg, #ff0080, #00ffff)',
                                color: '#000',
                                border: 'none',
                                padding: '8px 15px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            Search
                        </button>
                    </form>
                </div>

                <div style={{
                    background: 'rgba(36, 36, 62, 0.8)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 0, 128, 0.3)'
                }}>
                    <div style={{ padding: '30px' }}>
    {/* Anime title with back arrow */}
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', justifyContent: 'center'}}>
        <Link
            to="/search"
            style={{
                color: '#00ffff',
                textDecoration: 'none',
                fontSize: '2rem',
                marginRight: '15px',
                textShadow: '0 0 10px #00ffff',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1'
            }}
            onMouseEnter={(e) => {
                (e.target as HTMLElement).style.textShadow = '0 0 20px #00ffff';
                (e.target as HTMLElement).style.transform = 'translateX(-5px)';
            }}
            onMouseLeave={(e) => {
                (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                (e.target as HTMLElement).style.transform = 'translateX(0)';
            }}
        >
            ←
        </Link>
        <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            margin: 0,
            background: 'linear-gradient(45deg, #ff0080, #00ffff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            lineHeight: '1'
        }}>
            {getTitle(anime)}
        </h1>
    </div>

    {foundFandomUrl ? (
        <div style={{ marginBottom: '20px' }}>
            <a
                href={foundFandomUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    color: '#00ffff',
                    textDecoration: 'none',
                    fontSize: '14px',
                    textShadow: '0 0 10px #00ffff'
                }}
            >
                ✓ Found Fandom Wiki: {foundFandomUrl}
            </a>
        </div>
    ) : (
        <div style={{ marginBottom: '20px' }}>
            <span style={{
                color: '#ff0080',
                fontSize: '14px',
                textShadow: '0 0 10px #ff0080'
            }}>
                🔍 Searching for fandom wiki...
            </span>
        </div>
    )}
                        {anime.genres && anime.genres.length > 0 && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                marginBottom: '20px'
                            }}>
                                {anime.genres.map((genre) => (
                                    <span
                                        key={genre.mal_id}
                                        style={{
                                            background: 'linear-gradient(45deg, rgba(255, 0, 128, 0.3), rgba(0, 255, 255, 0.3))',
                                            border: '1px solid rgba(255, 0, 128, 0.5)',
                                            color: '#ffffff',
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            textShadow: '0 0 5px rgba(255, 255, 255, 0.5)'
                                        }}
                                    >
                                        {genre.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                            <div style={{ flexShrink: 0 }}>
                                <img
                                    src={anime.images.jpg.large_image_url}
                                    alt={getTitle(anime)}
                                    style={{
                                        width: '200px',
                                        height: 'auto',
                                        borderRadius: '15px',
                                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 0, 128, 0.3)',
                                        border: '2px solid rgba(255, 0, 128, 0.5)'
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/api/placeholder/225/350";
                                    }}
                                />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: '20px',
                                    marginBottom: '20px'
                                }}>
                                    <div>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Status:</span> {anime.status || 'Unknown'}</p>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Episodes:</span> {anime.episodes || 'Unknown'}</p>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Rating:</span> {anime.rating || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Season:</span> {anime.season && anime.year ? `${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)} ${anime.year}` : 'Unknown'}</p>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Score:</span> {anime.score ? `${anime.score} (${anime.scored_by?.toLocaleString()} votes)` : 'N/A'}</p>
                                        <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Rank:</span> {anime.rank ? `#${anime.rank}` : 'N/A'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p><span style={{ color: '#00ffff', fontWeight: 'bold' }}>Aired:</span> {formatDate(anime.aired.from)} to {anime.aired.to ? formatDate(anime.aired.to) : 'Present'}</p>
                                </div>
                            </div>
                        </div>

                        {anime.synopsis && (
                            <div style={{ marginTop: '30px' }}>
                                <h3 style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    color: '#ff0080',
                                    textShadow: '0 0 10px #ff0080'
                                }}>
                                    Summary
                                </h3>
                                <p style={{
                                    color: '#e0e0e0',
                                    lineHeight: '1.6',
                                    background: 'rgba(15, 12, 41, 0.5)',
                                    padding: '20px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(0, 255, 255, 0.2)'
                                }}>
                                    {anime.synopsis}
                                </p>
                            </div>
                        )}
                    </div>

                    <div style={{
                        padding: '30px',
                        borderTop: '1px solid rgba(255, 0, 128, 0.3)',
                        background: 'rgba(15, 12, 41, 0.5)'
                    }}>
                        <h2 style={{
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            marginBottom: '30px',
                            color: '#00ffff',
                            textShadow: '0 0 15px #00ffff'
                        }}>
                            Episodes
                        </h2>

                        {episodes.length > 0 ? (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                                gap: '20px'
                            }}>
                                {episodes.map((episode, index) => (
                                    <div
                                        key={episode.mal_id}
                                        style={{
                                            background: 'rgba(36, 36, 62, 0.8)',
                                            border: '1px solid rgba(255, 0, 128, 0.3)',
                                            borderRadius: '15px',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-5px)';
                                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 0, 128, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
                                        }}
                                    >
                                        <div style={{ padding: '20px' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '15px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                                                    <span style={{
                                                        background: 'linear-gradient(45deg, #ff0080, #00ffff)',
                                                        color: '#000',
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        minWidth: '40px',
                                                        textAlign: 'center'
                                                    }}>
                                                        {index + 1}
                                                    </span>
                                                    <div style={{
                                                        width: '2px',
                                                        height: '30px',
                                                        background: 'linear-gradient(45deg, #ff0080, #00ffff)'
                                                    }}></div>
                                                    <h3 style={{
                                                        fontSize: '16px',
                                                        fontWeight: 'bold',
                                                        margin: 0,
                                                        color: '#ffffff',
                                                        flex: 1
                                                    }}>
                                                        {episode.title}
                                                    </h3>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    {episode.aired && (
                                                        <p style={{
                                                            fontSize: '12px',
                                                            color: '#00ffff',
                                                            margin: 0,
                                                            textShadow: '0 0 5px #00ffff'
                                                        }}>
                                                            {formatDate(episode.aired)}
                                                        </p>
                                                    )}
                                                    <button
                                                        onClick={() => toggleInfo(episode.mal_id, episode.title, episode.episode)}
                                                        disabled={wikiSubdomain === "unknown"}
                                                        style={{
                                                            background: foundFandomUrl
                                                                ? 'linear-gradient(45deg, #ff0080, #00ffff)'
                                                                : 'rgba(128, 128, 128, 0.5)',
                                                            color: foundFandomUrl ? '#000' : '#666',
                                                            border: 'none',
                                                            padding: '8px 15px',
                                                            borderRadius: '8px',
                                                            cursor: foundFandomUrl ? 'pointer' : 'not-allowed',
                                                            fontWeight: 'bold',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    >
                                                        {showAiredStates[episode.mal_id] ? '▲' : '▼'}
                                                    </button>
                                                </div>
                                            </div>

                                            {(episode.filler || episode.recap) && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    {episode.filler && (
                                                        <span style={{
                                                            background: 'rgba(255, 193, 7, 0.3)',
                                                            color: '#ffc107',
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            marginRight: '8px',
                                                            border: '1px solid #ffc107'
                                                        }}>
                                                            Filler
                                                        </span>
                                                    )}
                                                    {episode.recap && (
                                                        <span style={{
                                                            background: 'rgba(108, 117, 125, 0.3)',
                                                            color: '#6c757d',
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '10px',
                                                            border: '1px solid #6c757d'
                                                        }}>
                                                            Recap
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {showAiredStates[episode.mal_id] && (
                                                <div style={{
                                                    marginTop: '15px',
                                                    padding: '15px',
                                                    background: 'rgba(15, 12, 41, 0.7)',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(0, 255, 255, 0.2)'
                                                }}>
                                                    {chapters[episode.mal_id] && chapters[episode.mal_id].length > 0 ? (
                                                        <div>
                                                            <h4 style={{
                                                                color: '#00ffff',
                                                                fontSize: '14px',
                                                                marginBottom: '10px',
                                                                textShadow: '0 0 5px #00ffff'
                                                            }}>
                                                                Episode Chapters:
                                                            </h4>
                                                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                <p style={{
                                                                    color: '#e0e0e0',
                                                                    fontSize: '13px',
                                                                    lineHeight: '1.5',
                                                                    margin: '8px 0',
                                                                    paddingLeft: '10px',
                                                                    borderLeft: '2px solid rgba(255, 0, 128, 0.3)'
                                                                }}>
                                                                    {chapters[episode.mal_id].join(', ')}
                                                                </p>
                                                            </div>
                                                            {successfulUrls[episode.mal_id] && (
                                                                <div style={{ marginBottom: '15px' }}>
                                                                    <a
                                                                        href={successfulUrls[episode.mal_id]}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{
                                                                            color: '#00ffff',
                                                                            textDecoration: 'none',
                                                                            fontSize: '12px',
                                                                            textShadow: '0 0 5px #00ffff',
                                                                            background: 'rgba(0, 255, 255, 0.1)',
                                                                            padding: '6px 10px',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid rgba(0, 255, 255, 0.3)',
                                                                            display: 'inline-block',
                                                                            transition: 'all 0.3s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            (e.target as HTMLElement).style.background = 'rgba(0, 255, 255, 0.2)';
                                                                            (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            (e.target as HTMLElement).style.background = 'rgba(0, 255, 255, 0.1)';
                                                                            (e.target as HTMLElement).style.textShadow = '0 0 5px #00ffff';
                                                                        }}
                                                                    >
                                                                        📖 View Full Episode Page
                                                                    </a>
                                                                </div>
                                                            )}

                                                        </div>
                                                    ) : fallbackData[episode.mal_id] ? (
                                                        <div>
                                                            <p style={{
                                                                color: '#ff0080',
                                                                fontSize: '14px',
                                                                marginBottom: '15px',
                                                                textShadow: '0 0 5px #ff0080'
                                                            }}>
                                                                {fallbackData[episode.mal_id].message}
                                                            </p>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                {fallbackData[episode.mal_id].links.map((link, linkIndex) => (
                                                                    <a
                                                                        key={linkIndex}
                                                                        href={link.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{
                                                                            color: '#00ffff',
                                                                            textDecoration: 'none',
                                                                            fontSize: '13px',
                                                                            padding: '8px 12px',
                                                                            background: 'rgba(0, 255, 255, 0.1)',
                                                                            borderRadius: '8px',
                                                                            border: '1px solid rgba(0, 255, 255, 0.3)',
                                                                            transition: 'all 0.3s ease',
                                                                            display: 'block'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            (e.target as HTMLElement).style.background = 'rgba(0, 255, 255, 0.2)';
                                                                            (e.target as HTMLElement).style.textShadow = '0 0 10px #00ffff';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            (e.target as HTMLElement).style.background = 'rgba(0, 255, 255, 0.1)';
                                                                            (e.target as HTMLElement).style.textShadow = 'none';
                                                                        }}
                                                                    >
                                                                        {link.title}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p style={{
                                                            color: '#666',
                                                            fontSize: '13px',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            {wikiSubdomain === "unknown"
                                                                ? "No Fandom wiki found for this anime"
                                                                : "Loading episode information..."}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{
                                color: '#666',
                                fontSize: '16px',
                                textAlign: 'center',
                                padding: '40px'
                            }}>
                                No episodes available
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EpisodesInformation;