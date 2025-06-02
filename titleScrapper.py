from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, urlparse, unquote
import time

app = Flask(__name__)
CORS(app)


@app.route('/search-anime-wiki', methods=['POST'])
def search_anime_wiki():
    try:
        data = request.get_json()

        if not data or 'anime_name' not in data:
            return jsonify({"success": False, "error": "Missing 'anime_name' in request"}), 400

        anime_name = data['anime_name'].strip()
        if not anime_name:
            return jsonify({"success": False, "error": "Empty anime name"}), 400
        
        print(f"[MAIN] 🔍 Searching fandom wiki for: {anime_name}")

        # Try direct method first
        direct_urls = find_fandom_wiki_direct(anime_name)
        if direct_urls:
            for url in direct_urls:
                if validate_anime_wiki(url, anime_name):
                    print(f"[MAIN] ✅ Found via DIRECT method: {url}")
                    return jsonify({"success": True, "url": url, "method": "direct"})

        # Fallback to DuckDuckGo if direct method fails
        print("[MAIN] 🦆 Trying DuckDuckGo fallback...")
        ddg_urls = web_search_fandom_ddg(anime_name)
        for url in ddg_urls:
            if validate_anime_wiki(url, anime_name):
                print(f"[MAIN] ✅ Found via DUCKDUCKGO: {url}")
                return jsonify({"success": True, "url": url, "method": "duckduckgo"})

        print(f"[MAIN] ❌ No valid Fandom wiki found for: {anime_name}")
        return jsonify({"success": False, "error": "No valid Fandom wiki found"}), 404

    except Exception as e:
        print(f"[MAIN] 💥 Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/search-episode-page', methods=['POST'])
def search_episode_page():
    """
    Enhanced endpoint to search for specific episode pages using both direct URL generation and web search
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Missing request data"}), 400
            
        subdomain = data.get('subdomain', '').strip()
        episode_title = data.get('episode_title', '').strip()
        episode_number = data.get('episode_number', '').strip()
        
        if not subdomain:
            return jsonify({"success": False, "error": "Missing subdomain"}), 400
            
        if not episode_title and not episode_number:
            return jsonify({"success": False, "error": "Missing both episode_title and episode_number"}), 400
        
        print(f"[EPISODE_SEARCH] 🎯 Searching for episode in {subdomain}.fandom.com")
        print(f"[EPISODE_SEARCH] Episode: {episode_number} - '{episode_title}'")
        
        # Method 1: Try web search first (more reliable)
        print("[EPISODE_SEARCH] 🔍 Trying web search method...")
        search_urls = web_search_episode_page(subdomain, episode_title, episode_number)
        
        for url in search_urls:
            print(f"[EPISODE_SEARCH] 🔗 Testing search result: {url}")
            if test_episode_url(url, episode_title, episode_number):
                print(f"[EPISODE_SEARCH] ✅ Found via WEB SEARCH: {url}")
                return jsonify({
                    "success": True, 
                    "url": url,
                    "episode_number": episode_number,
                    "episode_title": episode_title,
                    "method": "web_search"
                })
        
        # Method 2: Fallback to direct URL generation
        print("[EPISODE_SEARCH] 🔧 Trying direct URL generation...")
        possible_urls = generate_episode_urls(subdomain, episode_title, episode_number)
        
        for url in possible_urls:
            print(f"[EPISODE_SEARCH] 🔗 Testing direct URL: {url}")
            
            if test_episode_url(url, episode_title, episode_number):
                print(f"[EPISODE_SEARCH] ✅ Found via DIRECT: {url}")
                return jsonify({
                    "success": True, 
                    "url": url,
                    "episode_number": episode_number,
                    "episode_title": episode_title,
                    "method": "direct"
                })
            
            # Small delay between requests to be respectful
            time.sleep(0.2)
        
        print(f"[EPISODE_SEARCH] ❌ No working episode page found")
        return jsonify({
            "success": False, 
            "error": "No valid episode page found",
            "tried_search_urls": search_urls[:3],
            "tried_direct_urls": possible_urls[:5]
        }), 404
        
    except Exception as e:
        print(f"[EPISODE_SEARCH] 💥 Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


def generate_episode_urls(subdomain, episode_title, episode_number):
    base_url = f"https://{subdomain}.fandom.com/wiki/"
    urls = []

    if episode_number:
        number_match = re.search(r'\d+', str(episode_number))
        if number_match:
            num = number_match.group()
            num_int = int(num)
            urls.extend([
                f"{base_url}Episode_{num}",
                f"{base_url}Episode{num}",
                f"{base_url}Episode_{num_int:02d}",
                f"{base_url}Ep_{num}",
                f"{base_url}Ep{num}",
                f"{base_url}E{num}",
                f"{base_url}{num}",
                f"{base_url}Episode_{num}_(Season_1)",
            ])

    if episode_title:
        clean_title = clean_for_url(episode_title)
        urls.extend([
            f"{base_url}{clean_title}",
            f"{base_url}{clean_title}_(episode)",
            f"{base_url}{clean_title}_(Episode)",
        ])

        if episode_number:
            urls.extend([
                f"{base_url}Episode_{num}:_{clean_title}",
                f"{base_url}Episode_{num}_-_{clean_title}",
            ])

    if episode_number and episode_title:
        urls.extend([
            f"{base_url}{num}._{clean_title}",
            f"{base_url}{num}_-_{clean_title}",
            f"{base_url}{num}:_{clean_title}",
        ])

    # Deduplicate
    unique_urls = list(dict.fromkeys(urls))
    print(f"[GENERATE_URLS] 📋 Generated {len(unique_urls)} potential URLs")
    return unique_urls


def web_search_episode_page(subdomain, episode_title, episode_number):
    """
    DuckDuckGo search to find episode pages
    """
    search_urls = []
    try:
        query_parts = []

        if episode_title:
            query_parts.append(episode_title.strip())

        if episode_number:
            query_parts.append(f'episode {episode_number}')
        else:
            query_parts.append("episode")
        query_parts.append(f"site:{subdomain}.fandom.com")

        search_query = " ".join(query_parts)
        print(f"[EPISODE_SEARCH] 🔍 Query: {search_query}")

        encoded_query = quote_plus(search_query)
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        print("searchasd "+ search_url)
        response = requests.get(search_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        print("A")
        print(soup)
        for link in soup.find_all('a', href=True):
            print("b")
            href = link['href']
            print("b:", href) 
            if 'uddg=' in href:
                print("c")
                try:
                    actual_url = unquote(href.split('uddg=')[1].split('&')[0])
                    print(f"[WEB_SEARCH] 🌐 Candidate URL: {actual_url}")
                    if f'{subdomain}.fandom.com' in actual_url and '/wiki/' in actual_url:
                        search_urls.append(actual_url)
                except Exception as e:
                    print(f"[WEB_SEARCH] ⚠️ Error decoding link: {e}")
                search_urls = list(dict.fromkeys(search_urls))

        if episode_number:
            preferred = f"/wiki/Episode_{int(episode_number)}"
            search_urls.sort(key=lambda url: (preferred not in url, len(url)))

        print(f"[EPISODE_SEARCH] 📋 Found {len(search_urls)} potential URLs")
        return search_urls[:10]

    except Exception as e:
        print(f"[EPISODE_SEARCH] 💥 Web search failed: {e}")
        return []


def url_exists(url):
    try:
        response = requests.head(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        return response.status_code == 200
    except Exception:
        return False


def find_episode_urls(subdomain, episode_title, episode_number):
    """
    Try generated URLs first, fallback to web search
    """
    # Step 1: Try generated URLs
    generated_urls = generate_episode_urls(subdomain, episode_title, episode_number)
    valid_urls = [url for url in generated_urls if url_exists(url)]
    if valid_urls:
        print(f"[FIND_EPISODE] ✅ Valid URL(s) from generated patterns: {valid_urls}")
        return valid_urls

    # Step 2: Fallback to web search
    search_results = web_search_episode_page(subdomain, episode_title, episode_number)
    return search_results

def clean_for_url(text):
    """
    Clean text for URL formatting (similar to MediaWiki URL encoding)
    """
    if not text:
        return ""
    
    # Replace spaces with underscores
    cleaned = text.replace(' ', '_')
    
    # Remove or replace problematic characters
    cleaned = re.sub(r'[<>"\[\]{}|\\^`]', '', cleaned)
    
    # Handle special characters that are usually URL encoded
    cleaned = cleaned.replace('?', '%3F')
    cleaned = cleaned.replace('#', '%23')
    cleaned = cleaned.replace('&', '%26')
    
    return cleaned

def test_episode_url(url, episode_title="", episode_number=""):
    """
    Test if a Fandom episode URL is valid and matches the expected episode number or title
    """
    try:
        response = requests.get(url, timeout=8, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        })
        
        if response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Check for "Episode X" in the title or heading
        title_text = soup.title.get_text().lower() if soup.title else ''
        heading_text = soup.find('h1').get_text().lower() if soup.find('h1') else ''
        page_text = soup.get_text().lower()

        if episode_number:
            ep_number_variants = [f"episode {int(episode_number)}", f"episode_{int(episode_number)}"]
            if any(variant in url.lower() for variant in ep_number_variants) or \
               any(variant in title_text for variant in ep_number_variants) or \
               any(variant in heading_text for variant in ep_number_variants):
                return True

        if episode_title:
            # Split on '/' or ' / ' and use the first part for matching (most relevant part)
            segments = [seg.strip().lower() for seg in episode_title.split('/') if seg.strip()]
            if any(seg in page_text for seg in segments):
                return True

        # If neither matches, still return True if the page is valid and relevant
        if 'disambiguation' in page_text or 'search results' in page_text:
            return False

        print("sdfsdfsdfsdfsdfs\n\n\n\n\n")
        return True

    except Exception as e:
        print(f"[TEST_URL] ❌ Error testing {url}: {e}")
        return False


@app.route('/get-episode-content', methods=['POST'])
def get_episode_content():
    """
    Fetch content from a specific episode page URL
    """
    try:
        data = request.get_json()
        url = data.get('url')

        if not url or not url.startswith('https://'):
            return jsonify({"success": False, "error": "Invalid or missing URL"}), 400

        print(f"[CONTENT] 📄 Fetching content from: {url}")
        response = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        if response.status_code != 200:
            return jsonify({"success": False, "error": f"Failed with status code {response.status_code}"}), 500

        # Parse and extract relevant content
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to extract chapters or relevant information
        chapters = extract_chapter_info(soup)
        
        return jsonify({
            "success": True, 
            "url": url,
            "chapters": chapters,
            "html": response.text  # Include full HTML if needed
        })

    except Exception as e:
        print(f"[CONTENT] 💥 Error fetching content: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


def extract_chapter_info(soup):
    """
    Extract chapter information from the episode page using specific div targeting
    """
    # Find all data blocks that contain the relevant links
    data_blocks = soup.find_all("div", class_="pi-item pi-data pi-item-spacing pi-border-color")

    chapters = []
    for block in data_blocks:
        # Step 2: Check if the label refers to a chapter
        label_tag = block.find("h3", class_="pi-data-label pi-secondary-font")
        value_div = block.find("div", class_="pi-data-value pi-font")
        
        if not label_tag or not value_div:
            continue  # skip malformed blocks

        label_text = label_tag.get_text(strip=True).lower()

        if "chapter" in label_text or "manga" in label_text:
            a_tags = value_div.find_all("a")
            for a in a_tags:
                text = a.get_text(strip=True)
                
                # Step 3: Prioritize chapter number if available
                if "chapter" in text.lower():
                    numbers = re.findall(r'\d+', text)
                    if numbers:
                        chapters.extend(numbers)
                elif text.isdigit():
                    chapters.append(text)
                else:
                    # Fallback: add the full text if no numbers found
                    chapters.append(text)

    # Remove duplicates while preserving order
    chapters = list(dict.fromkeys(chapters))

    print("Extracted Chapters (or related tags):")
    print(chapters)
    
    return chapters

# Keep existing functions
def find_fandom_wiki_direct(anime_name):
    """Try to find anime wiki by constructing likely URLs with better variations"""
    print(f"[DIRECT] 🎯 Trying direct URL construction for: {anime_name}")
    
    # Create multiple variations of the anime name
    variations = create_url_variations(anime_name)
    
    found_urls = []
    
    for variation in variations:
        # Test the main fandom URL pattern
        test_url = f"https://{variation}.fandom.com"
        print(f"[DIRECT] 🔗 Testing: {test_url}")
        
        if test_url_exists(test_url):
            found_urls.append(test_url)
            print(f"[DIRECT] ✅ FOUND: {test_url}")
    
    return found_urls


def create_url_variations(anime_name):
    """Create URL variations with better handling for complex titles"""
    variations = []
    
    # Convert to lowercase and clean
    clean_name = anime_name.lower().strip()
    
    # Special handling for known anime patterns
    special_cases = {
        'kaguya': ['kaguyasama-wa-kokurasetai', 'kaguya-sama-wa-kokurasetai', 'kaguyasama'],
        'love is war': ['kaguyasama-wa-kokurasetai'],
        'haikyuu': ['haikyuu'],
        'attack on titan': ['shingeki-no-kyojin', 'attackontitan'],
        'demon slayer': ['kimetsu-no-yaiba', 'demonslayer'],
        'my hero academia': ['boku-no-hero-academia', 'myheroacademia'],
        'jujutsu kaisen': ['jujutsu-kaisen', 'jujutsukaisen'],
        'one piece': ['onepiece'],
        'dragon ball': ['dragonball'],
    }
    
    # Check for special cases first
    for key, values in special_cases.items():
        if key in clean_name:
            variations.extend(values)
    
    # Standard variations
    clean_for_url = re.sub(r'[!@#$%^&*()+=\[\]{}|\\:";\'<>?,./]', '', clean_name)
    clean_for_url = re.sub(r'\s+', ' ', clean_for_url).strip()
    
    # Create variations
    variations.extend([
        clean_for_url.replace(' ', ''),
        clean_for_url.replace(' ', '-'),
        clean_for_url.split()[0] if ' ' in clean_for_url else clean_for_url,
    ])
    
    # Remove duplicates
    unique_variations = []
    seen = set()
    for var in variations:
        if var and var not in seen and len(var) > 1:
            seen.add(var)
            unique_variations.append(var)
    
    return unique_variations


def test_url_exists(url):
    """Test if a fandom URL exists and redirects properly"""
    try:
        response = requests.get(url, timeout=8, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, allow_redirects=True)
        
        if response.status_code == 200 and 'fandom.com' in response.url:
            return True
        return False
        
    except Exception:
        return False


def web_search_fandom_ddg(anime_name):
    """Backup DuckDuckGo search method"""
    try:
        search_query = f'"{anime_name}" fandom wiki site:fandom.com'
        encoded_query = quote_plus(search_query)
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        response = requests.get(search_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        links = soup.find_all('a', href=True)

        found_urls = []
        for link in links:
            href = link['href']
            if 'uddg=' in href:
                try:
                    actual_url = unquote(href.split('uddg=')[1].split('&')[0])
                    if 'fandom.com' in actual_url:
                        parsed = urlparse(actual_url)
                        base_url = f"{parsed.scheme}://{parsed.netloc}"
                        if base_url not in found_urls:
                            found_urls.append(base_url)
                except Exception:
                    continue

        return found_urls[:5]

    except Exception as e:
        print(f"[DDG] 💥 Search failed: {e}")
        return []


def validate_anime_wiki(url, anime_title):
    """Enhanced validation with stricter matching"""
    try:
        response = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        if response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, 'html.parser')
        page_title = soup.title.string.lower() if soup.title else ""
        
        main_content = ""
        for selector in ['div.page-content', 'div.mw-content-text', 'div.WikiaArticle', 'main', '#content']:
            content_div = soup.select_one(selector)
            if content_div:
                main_content = content_div.get_text().lower()[:2000]
                break

        cleaned_anime = re.sub(r'[^\w\s-]', ' ', anime_title).lower()
        anime_words = [word for word in cleaned_anime.split() if len(word) > 2]
        
        content_matches = sum(1 for word in anime_words if word in main_content)
        content_match_ratio = content_matches / len(anime_words) if anime_words else 0
        
        is_fandom = any(indicator in page_title for indicator in ['wiki', 'fandom'])
        anime_indicators = ['anime', 'manga', 'episode', 'character', 'series']
        has_anime_content = sum(1 for indicator in anime_indicators if indicator in main_content) >= 2
        
        return content_match_ratio >= 0.4 and is_fandom and has_anime_content

    except Exception:
        return False


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy', 
        'message': 'Anime Wiki Finder API is running',
        'endpoints': {
            '/search-anime-wiki': 'Find anime fandom wiki',
            '/search-episode-page': 'Find specific episode page within a wiki',
            '/get-episode-content': 'Get content from episode page'
        }
    })


if __name__ == '__main__':
    print("🚀 Starting Enhanced Anime Wiki Finder...")
    print("✨ New feature: Episode-specific page search!")
    print("\n📋 Available endpoints:")
    print("  POST /search-anime-wiki - Find anime fandom wiki")
    print("  POST /search-episode-page - Find specific episode page")
    print("  POST /get-episode-content - Get episode page content")
    print("  GET  /health - Health check")
    
    app.run(debug=True, port=5000)