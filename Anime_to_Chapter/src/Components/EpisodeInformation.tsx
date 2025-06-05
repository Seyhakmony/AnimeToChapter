import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import '../Css/Ep.css';


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


    const [localSearchQuery, setlocalSearchQuery] = useState('');

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

                // Fetch all episodes from all pages
                let allEpisodes: Episode[] = [];
                let currentPage = 1;
                let hasNextPage = true;

                while (hasNextPage) {
                    const episodesResponse = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes?page=${currentPage}`);
                    if (!episodesResponse.ok) {
                        throw new Error('Failed to fetch episodes');
                    }
                    const episodesData: JikanEpisodesResponse = await episodesResponse.json();

                    allEpisodes = [...allEpisodes, ...episodesData.data];
                    hasNextPage = episodesData.pagination.has_next_page;
                    currentPage++;

                    // Add delay between requests to respect rate limits
                    if (hasNextPage) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                setEpisodes(allEpisodes);
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
        setSearchQuery('');
    }, [setSearchQuery]);


    //searching anime
    const navigate = useNavigate();

    // Function to search for anime
    const searchAnime = async () => {
        if (!searchQuery.trim()) return;

        setGlobalIsLoading(true);
        setGlobalError(null);
        setSearchQuery(localSearchQuery);

        try {
            const response = await fetch(
                // `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=20&order_by=popularity&sort=asc`
                `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=20&order_by=popularity&sort=asc&type=tv`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch data from Jikan API');
            }

            const data: JikanResponse = await response.json();
            setSearchResults(data.data);

            // Add these two lines to store the search data
            sessionStorage.setItem('searchQuery', searchQuery);
            sessionStorage.setItem('searchResults', JSON.stringify(data.data));

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
                // const response = await fetch('http://localhost:5000/search-anime-wiki', {
                const response = await fetch('https://blankcode.pythonanywhere.com/search-anime-wiki', {
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

            // const response = await fetch('http://localhost:5000/search-episode-page', {
            const response = await fetch('http://blankcode.pythonanywhere.com/search-episode-page', {
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

            // const response = await fetch('http://localhost:5000/get-episode-content', {
            const response = await fetch('http://blankcode.pythonanywhere.com/get-episode-content', {
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
            <div className="episode-loading-container">
                <div className="episode-loading-text">
                    Loading...
                </div>
                <div className="episode-loading-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="episode-header-container">
                <Link to="/" className="episode-logo-link">
                    AniChapter
                </Link>
                <div className="error-message">
                    <h2>No Anime Found</h2>
                    <p>Anime does not exist. Please search for another anime title.</p>
                </div>
                <form onSubmit={handleSubmit} className="episode-search-form">
                    <input
                        type="text"
                        value={localSearchQuery}
                        onChange={(e) => setlocalSearchQuery(e.target.value)}
                        placeholder="Search for another anime..."
                        className="episode-search-input"
                    />
                    <button type="submit" className="episode-search-button">
                        Search
                    </button>
                </form>
            </div>
        );
    }

    if (!anime) {
        return (
            <div className="episode-header-container">
                <Link to="/" className="episode-logo-link">
                    AniChapter
                </Link>
                <div className="error-message">
                    <h2>No Anime Found</h2>
                    <p>Anime does not exist. Please search for another anime title.</p>
                </div>
                <form onSubmit={handleSubmit} className="episode-search-form">
                    <input
                        type="text"
                        value={localSearchQuery}
                        onChange={(e) => setlocalSearchQuery(e.target.value)}
                        placeholder="Search for another anime..."
                        className="episode-search-input"
                    />
                    <button type="submit" className="episode-search-button">
                        Search
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="episode-main-container">
            <div className="episode-content-wrapper">
                {/* Header with logo and search */}
                <div className="episode-header-container">
                    <Link to="/" className="episode-logo-link">
                        AniChapter
                    </Link>
                    <form onSubmit={handleSubmit} className="episode-search-form">
                        <input
                            type="text"
                            value={localSearchQuery}
                            onChange={(e) => setlocalSearchQuery(e.target.value)}
                            placeholder="Search for another anime..."
                            className="episode-search-input"
                        />
                        <button type="submit" className="episode-search-button">
                            Search
                        </button>
                    </form>
                </div>

                <div className="episode-anime-card">
                    <div className="episode-anime-details">
                        {/* Anime title with back arrow */}
                        <div className="episode-title-section">
                            <Link to="/search" className="episode-back-arrow">
                                ←
                            </Link>
                            <h1 className="episode-anime-title">
                                {getTitle(anime)}
                            </h1>
                        </div>

                        {foundFandomUrl ? (
                            <div className="episode-wiki-found">
                                <a
                                    href={foundFandomUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ✓ Found Fandom Wiki: {foundFandomUrl}
                                </a>
                            </div>
                        ) : (
                            <div className="episode-wiki-searching">
                                <span>
                                    🔍 Searching for fandom wiki...
                                </span>
                            </div>
                        )}

                        <div className="episode-anime-info-layout">
                            <div className="episode-anime-image-container">
                                <img
                                    src={anime.images.jpg.large_image_url}
                                    alt={getTitle(anime)}
                                    className="episode-anime-image"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/api/placeholder/225/350";
                                    }}
                                />
                            </div>

                            <div className="episode-anime-info">
                                <div className="episode-info-grid">
                                    <div>
                                        <p><span className="episode-info-label">Status:</span> {anime.status || 'Unknown'}</p>
                                        <p><span className="episode-info-label">Episodes:</span> {anime.episodes || 'Unknown'}</p>
                                        <p><span className="episode-info-label">Rating:</span> {anime.rating || 'Unknown'}</p>
                                    </div>
                                    <div>
                                        <p><span className="episode-info-label">Season:</span> {anime.season && anime.year ? `${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)} ${anime.year}` : 'Unknown'}</p>
                                        <p><span className="episode-info-label">Score:</span> {anime.score ? `${anime.score} (${anime.scored_by?.toLocaleString()} votes)` : 'N/A'}</p>
                                        <p><span className="episode-info-label">Rank:</span> {anime.rank ? `#${anime.rank}` : 'N/A'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p><span className="episode-info-label">Aired:</span> {formatDate(anime.aired.from)} to {anime.aired.to ? formatDate(anime.aired.to) : 'Present'}</p>
                                </div>
                            </div>
                        </div>

                        {anime.synopsis && (
                            <div className="episode-synopsis-section">
                                <h3 className="episode-synopsis-title">
                                    Summary
                                </h3>
                                <p className="episode-synopsis-text">
                                    {anime.synopsis}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="episode-episodes-section">
                        <h2 className="episode-episodes-title">
                            Episodes
                        </h2>

                        {episodes.length > 0 ? (
                            <div className="episode-episodes-grid">
                                {episodes.map((episode, index) => (
                                    <div key={episode.mal_id} className="episode-episode-card">
                                        <div className="episode-episode-content">
                                            <div className="episode-episode-header">
                                                <div className="episode-episode-main-info">
                                                    <span className="episode-episode-number">
                                                        {index + 1}
                                                    </span>
                                                    <div className="episode-episode-divider"></div>
                                                    <h3 className="episode-episode-title">
                                                        {episode.title}
                                                    </h3>
                                                </div>

                                                <div className="episode-episode-meta">
                                                    {episode.aired && (
                                                        <p className="episode-episode-date">
                                                            {formatDate(episode.aired)}
                                                        </p>
                                                    )}
                                                    <button
                                                        onClick={() => toggleInfo(episode.mal_id, episode.title, episode.episode)}
                                                        disabled={wikiSubdomain === "unknown"}
                                                        className={`episode-toggle-button ${foundFandomUrl ? 'episode-toggle-button-enabled' : 'episode-toggle-button-disabled'}`}
                                                    >
                                                        {showAiredStates[episode.mal_id] ? '▲' : '▼'}
                                                    </button>
                                                </div>
                                            </div>

                                            {(episode.filler || episode.recap) && (
                                                <div className="episode-episode-tags">
                                                    {episode.filler && (
                                                        <span className="episode-filler-tag">
                                                            Filler
                                                        </span>
                                                    )}
                                                    {episode.recap && (
                                                        <span className="episode-recap-tag">
                                                            Recap
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {showAiredStates[episode.mal_id] && (
                                                <div className="episode-episode-details">
                                                    {chapters[episode.mal_id] && chapters[episode.mal_id].length > 0 ? (
                                                        <div>
                                                            <h4 className="episode-chapters-title">
                                                                Episode Chapters:
                                                            </h4>
                                                            <div className="episode-chapters-container">
                                                                <p className="episode-chapters-text">
                                                                    {chapters[episode.mal_id].join(', ')}
                                                                </p>
                                                            </div>
                                                            {successfulUrls[episode.mal_id] && (
                                                                <div style={{ marginBottom: '15px' }}>
                                                                    <a
                                                                        href={successfulUrls[episode.mal_id]}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="episode-episode-link"
                                                                    >
                                                                        📖 View Full Episode Page
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : successfulUrls[episode.mal_id] && successfulUrls[episode.mal_id] !== '' ? (
                                                        <div>
                                                            <p className="episode-fallback-message">
                                                                No Chapter's Found
                                                            </p>
                                                            <div style={{ marginBottom: '15px' }}>
                                                                <a
                                                                    href={successfulUrls[episode.mal_id]}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="episode-episode-link"
                                                                >
                                                                    📖 View Full Episode Page
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ) : fallbackData[episode.mal_id] ? (
                                                        <div>
                                                            <p className="episode-fallback-message">
                                                                {fallbackData[episode.mal_id].message}
                                                            </p>
                                                            <div className="episode-fallback-links">
                                                                {fallbackData[episode.mal_id].links.map((link, linkIndex) => (
                                                                    <a
                                                                        key={linkIndex}
                                                                        href={link.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="episode-fallback-link"
                                                                    >
                                                                        {link.title}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="episode-loading-info">
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
                            <p className="episode-no-episodes">
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