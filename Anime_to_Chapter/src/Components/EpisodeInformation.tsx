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

interface EpisodeSearchResponse {
    success: boolean;
    url?: string;
    episode_number?: string;
    episode_title?: string;
    error?: string;
    tried_urls?: string[];
}

interface EpisodeContentResponse {
    success: boolean;
    url?: string;
    chapters?: string[];
    html?: string;
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
    // Store the successful URL for each episode
    const [successfulUrls, setSuccessfulUrls] = useState<{ [episodeId: number]: string }>({});
    const [foundFandomUrl, setFoundFandomUrl] = useState<string>("");
    const [wikiSubdomain, setWikiSubdomain] = useState<string>("");

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

                        // Only stop searching if we get a successful response AND a valid URL
                        if (data.success && data.url && data.url.trim() !== '') {
                            setFoundFandomUrl(data.url);
                            const subdomain = extractSubdomain(data.url);
                            setWikiSubdomain(subdomain);
                            return; // Found valid URL, stop searching
                        }

                        // Add delay between requests (except for the last one)
                        if (i < allTitles.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }

                    } catch (err) {
                        console.error(`Error searching with title "${currentTitle}":`, err);
                        // Continue to next title on error
                        continue;
                    }
                }

                // If we've gone through all titles without finding a valid URL
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
            anime.titles[0]?.title || // fallback to first title if available
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

    // Updated to use the new backend endpoint for finding episode pages
    const findEpisodePage = async (subdomain: string, episodeTitle: string, episodeNumber: string): Promise<string | null> => {
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

            if (!response.ok) {
                console.error(`Episode search failed with status: ${response.status}`);
                return null;
            }

            const data: EpisodeSearchResponse = await response.json();
            
            if (data.success && data.url) {
                console.log(`Found episode page: ${data.url}`);
                return data.url;
            } else {
                console.log(`No episode page found: ${data.error}`);
                return null;
            }
        } catch (err) {
            console.error(`Error searching for episode page:`, err);
            return null;
        }
    };

    // Updated to use the new backend endpoint for getting episode content
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
            // Check if it's a network error
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
        // Check if we already have a successful URL for this episode
        if (successfulUrls[episodeId]) {
            const cachedUrl = successfulUrls[episodeId];
            const chaptersData = await getEpisodeContent(cachedUrl);
            setChapters((prev) => ({ ...prev, [episodeId]: chaptersData }));
            return;
        }

        // Use the new backend endpoint to find the episode page
        const episodeUrl = await findEpisodePage(subdomain, episodeTitle, episodeNumber);
        
        if (episodeUrl) {
            // Cache the successful URL
            setSuccessfulUrls((prev) => ({ ...prev, [episodeId]: episodeUrl }));
            
            // Get the episode content
            const chaptersData = await getEpisodeContent(episodeUrl);
            setChapters((prev) => ({ ...prev, [episodeId]: chaptersData }));
        } else {
            // No episode page found
            setSuccessfulUrls((prev) => ({ ...prev, [episodeId]: '' }));
            setChapters((prev) => ({ ...prev, [episodeId]: [] }));
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center min-h-screen text-red-500">Error: {error}</div>;
    }

    if (!anime) {
        return <div className="flex justify-center items-center min-h-screen">No anime data found</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <Link to="/" className="text-blue-500 hover:text-blue-700 mb-4 inline-block">
                    ← Back to Search
                </Link>
                
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/3">
                        <img 
                            src={anime.images.jpg.large_image_url} 
                            alt={getTitle(anime)}
                            className="w-full rounded-lg shadow-lg"
                        />
                    </div>
                    
                    <div className="md:w-2/3">
                        <h1 className="text-3xl font-bold mb-4">{getTitle(anime)}</h1>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <strong>Status:</strong> {anime.status}
                            </div>
                            <div>
                                <strong>Episodes:</strong> {anime.episodes || 'Unknown'}
                            </div>
                            <div>
                                <strong>Score:</strong> {anime.score || 'N/A'}
                            </div>
                            <div>
                                <strong>Year:</strong> {anime.year || 'Unknown'}
                            </div>
                        </div>
                        
                        {anime.synopsis && (
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold mb-2">Synopsis</h2>
                                <p className="text-gray-700">{anime.synopsis}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <h2 className="text-2xl font-bold mb-4">Episodes</h2>
                {foundFandomUrl && (
                    <div className="mb-4 p-4 bg-green-100 rounded-lg">
                        <p className="text-green-800">
                            <strong>Found Fandom Wiki:</strong> 
                            <a href={foundFandomUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:text-blue-800">
                                {foundFandomUrl}
                            </a>
                        </p>
                    </div>
                )}
                
                <div className="space-y-4">
                    {episodes.map((episode) => (
                        <div key={episode.mal_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-2">
                                        Episode {episode.episode}: {episode.title}
                                    </h3>
                                    <p className="text-gray-600 mb-2">
                                        Aired: {formatDate(episode.aired)}
                                    </p>
                                    {episode.filler && (
                                        <span className="inline-block bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-sm mr-2">
                                            Filler
                                        </span>
                                    )}
                                    {episode.recap && (
                                        <span className="inline-block bg-blue-200 text-blue-800 px-2 py-1 rounded text-sm">
                                            Recap
                                        </span>
                                    )}
                                </div>
                                
                                <button
                                    onClick={() => toggleInfo(episode.mal_id, episode.title, episode.episode)}
                                    className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    disabled={wikiSubdomain === "unknown"}
                                >
                                    {showAiredStates[episode.mal_id] ? 'Hide Info' : 'Show Info'}
                                </button>
                            </div>
                            
                            {showAiredStates[episode.mal_id] && (
                                <div className="mt-4 p-4 bg-gray-50 rounded">
                                    {chapters[episode.mal_id] && chapters[episode.mal_id].length > 0 ? (
                                        <div>
                                            <h4 className="font-semibold mb-2">Chapters covered:</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {chapters[episode.mal_id].map((chapter, index) => (
                                                    <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                        Chapter {chapter}
                                                    </span>
                                                ))}
                                            </div>
                                            {successfulUrls[episode.mal_id] && (
                                                <div className="mt-2">
                                                    <a 
                                                        href={successfulUrls[episode.mal_id]} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                                    >
                                                        View on Fandom Wiki →
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-gray-600">
                                            {wikiSubdomain === "unknown" 
                                                ? "No Fandom wiki found for this anime" 
                                                : "Loading chapter information..."
                                            }
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EpisodesInformation;