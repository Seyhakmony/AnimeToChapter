from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, urlparse, unquote
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException


def create_driver():
    """Create a new Chrome driver instance with enhanced stability"""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")
    options.add_argument("--disable-images")
    options.add_argument("--disable-javascript")  # Disable JS for faster loading
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # Add prefs to reduce resource usage
    prefs = {
        "profile.managed_default_content_settings.images": 2,
        "profile.default_content_setting_values.notifications": 2
    }
    options.add_experimental_option("prefs", prefs)
    
    try:
        driver = webdriver.Chrome(options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        print(f"[DRIVER] ❌ Failed to create driver: {e}")
        return None

app = Flask(__name__)
CORS(app)

# 1. Update the main search function to handle the new return format:

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

        # Try direct method first - now returns immediately when found
        direct_url = find_fandom_wiki_direct(anime_name)
        if direct_url:
            print(f"[MAIN] ✅ Found via DIRECT method: {direct_url}")
            return jsonify({"success": True, "url": direct_url, "method": "direct"})

        # Only continue to fallback if no direct URL was found
        print("[MAIN] 🔍 Trying fallback search methods...")
        fallback_urls = fallback_search_methods(anime_name)
        for url in fallback_urls:
            if validate_anime_wiki(url, anime_name):
                print(f"[MAIN] ✅ Found via FALLBACK: {url}")
                return jsonify({"success": True, "url": url, "method": "fallback"})

        print(f"[MAIN] ❌ No valid Fandom wiki found for: {anime_name}")
        return jsonify({"success": False, "error": "No valid Fandom wiki found"}), 404

    except Exception as e:
        print(f"[MAIN] 💥 Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    

@app.route('/search-episode-page', methods=['POST'])
def search_episode_page():
    print("starting episode search")
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
        
        # Method 1: Try direct URL generation
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
            time.sleep(0.2)

        # Method 2: Try Google search for episode
        print("[EPISODE_SEARCH] 🌐 Trying Google search for episode...")
        google_urls = google_episode_search(subdomain, episode_title, episode_number)
        
        for url in google_urls:
            print(f"[EPISODE_SEARCH] 🔗 Testing Google result: {url}")
            if test_episode_url(url, episode_title, episode_number):
                print(f"[EPISODE_SEARCH] ✅ Found via GOOGLE: {url}")
                return jsonify({
                    "success": True, 
                    "url": url,
                    "episode_number": episode_number,
                    "episode_title": episode_title,
                    "method": "google_search"
                })

        # Method 3: Try fallback search method (scraping episode lists)
        print("[Episode FALLBACK] 🔍 Trying fallback search method...")
        search_urls = fallback_episode_search(subdomain, episode_title, episode_number)
        
        for url in search_urls:
            print(f"[EPISODE_SEARCH] 🔗 Testing search result: {url}")
            if test_episode_url(url, episode_title, episode_number):
                print(f"[EPISODE_SEARCH] ✅ Found via FALLBACK: {url}")
                return jsonify({
                    "success": True, 
                    "url": url,
                    "episode_number": episode_number,
                    "episode_title": episode_title,
                    "method": "fallback_search"
                })
        
        # Last resort: Get anime series links from navigation
        print(f"[EPISODE_SEARCH] 🔗 Last resort: Getting anime series links...")
        anime_links = get_anime_series_links(subdomain)
        
        if anime_links:
            print(f"[EPISODE_SEARCH] 📚 Found {len(anime_links)} anime series links as fallback")
            return jsonify({
                "success": False,
                "error": "Episode not found, but anime series available",
                "fallback_message": "Chapter scrape couldn't be done, please look for it below:",
                "anime_series_links": anime_links,
                "method": "anime_series_fallback"
            }), 404
        
        print(f"[EPISODE_SEARCH] ❌ No working episode page found")
        return jsonify({
            "success": False, 
            "error": "No valid episode page found",
            "tried_direct_urls": possible_urls[:5],
            "tried_google_urls": google_urls[:3],
            "tried_search_urls": search_urls[:3]
        }), 404
        
    except Exception as e:
        print(f"[EPISODE_SEARCH] 💥 Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    
    
def google_episode_search(subdomain, episode_title, episode_number):
    """Use Google search to find specific episode pages"""
    try:
        # Build multiple search queries to try
        search_queries = []
        
        # Query 1: Site-specific with episode number and title
        if episode_number and episode_title:
            search_queries.append(f'site:{subdomain}.fandom.com "episode {episode_number}" "{episode_title}"')
            search_queries.append(f'site:{subdomain}.fandom.com episode {episode_number} "{episode_title}"')
        
        # Query 2: Just episode title
        if episode_title:
            search_queries.append(f'site:{subdomain}.fandom.com "{episode_title}"')
            search_queries.append(f'site:{subdomain}.fandom.com {episode_title}')
        
        # Query 3: Just episode number
        if episode_number:
            search_queries.append(f'site:{subdomain}.fandom.com "episode {episode_number}"')
        
        found_urls = []
        
        for search_query in search_queries:
            print(f"[GOOGLE_EPISODE] 🔍 Search query: {search_query}")
            
            # Try both Google and DuckDuckGo
            search_engines = [
                ("Google", f"https://www.google.com/search?q={quote_plus(search_query)}"),
                ("DuckDuckGo", f"https://duckduckgo.com/html/?q={quote_plus(search_query)}")
            ]
            
            for engine_name, search_url in search_engines:
                try:
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                    
                    response = requests.get(search_url, headers=headers, timeout=10)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, 'html.parser')
                        
                        # Look for search result links
                        for link in soup.find_all('a', href=True):
                            href = link['href']
                            actual_url = None
                            
                            # Handle Google URLs
                            if '/url?q=' in href:
                                try:
                                    actual_url = href.split('/url?q=')[1].split('&')[0]
                                    actual_url = unquote(actual_url)
                                except:
                                    continue
                            
                            # Handle DuckDuckGo URLs  
                            elif href.startswith('http') and f"{subdomain}.fandom.com" in href:
                                actual_url = href
                            
                            # Handle relative URLs that might be direct fandom links
                            elif '/wiki/' in href and href.startswith('/'):
                                actual_url = f"https://{subdomain}.fandom.com{href}"
                            
                            if actual_url and f"{subdomain}.fandom.com" in actual_url and "/wiki/" in actual_url:
                                # Avoid episode lists/guides
                                if not any(avoid in actual_url.lower() for avoid in ['episode_guide', 'episodes', 'list', 'category']):
                                    if actual_url not in found_urls:
                                        found_urls.append(actual_url)
                                        print(f"[GOOGLE_EPISODE] 🌐 Found via {engine_name}: {actual_url}")
                                        
                                        if len(found_urls) >= 8:  # Limit total results
                                            return found_urls
                                
                                time.sleep(0.1)  # Small delay between extractions
                
                except Exception as e:
                    print(f"[GOOGLE_EPISODE] ⚠️ {engine_name} failed: {e}")
                    continue
                
                time.sleep(0.5)  # Delay between search engines
            
            if found_urls:  # If we found results, don't try more queries
                break
            
            time.sleep(1)  # Delay between different queries
        
        return found_urls
    
    except Exception as e:
        print(f"[GOOGLE_EPISODE] ❌ Failed: {e}")
    
    return []


def fallback_search_methods(anime_name):
    """Alternative search methods when Selenium fails"""
    print(f"[FALLBACK] 🔍 Using alternative search methods for: {anime_name}")
    
    found_urls = []
    
    # Method 1: Try common anime wiki patterns
    common_patterns = [
        anime_name.lower().replace(' ', ''),
        anime_name.lower().replace(' ', '-'),
        ''.join(word for word in anime_name.split() if word.lower() not in ['the', 'a', 'an']).lower(),
    ]
    
    for pattern in common_patterns:
        test_url = f"https://{pattern}.fandom.com"
        if test_url_exists(test_url):
            found_urls.append(test_url)
            print(f"[FALLBACK] ✅ Found via pattern: {test_url}")
    
    # Method 2: Try requests-based search (faster than Selenium)
    try:
        search_urls = requests_based_search(anime_name)
        found_urls.extend(search_urls)
    except Exception as e:
        print(f"[FALLBACK] ⚠️ Requests search failed: {e}")
    
    return found_urls


def requests_based_search(anime_name):
    """Use requests to search instead of Selenium for better reliability"""
    try:
        # Use DuckDuckGo as it's more reliable than Google for automated requests
        search_query = f"{anime_name} fandom wiki site:fandom.com"
        search_url = f"https://duckduckgo.com/html/?q={quote_plus(search_query)}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            found_urls = []
            # Look for fandom.com links
            for link in soup.find_all('a', href=True):
                href = link['href']
                if 'fandom.com' in href and href.startswith('http'):
                    # Extract base URL
                    parsed = urlparse(href)
                    if parsed.netloc.endswith('.fandom.com'):
                        base_url = f"{parsed.scheme}://{parsed.netloc}"
                        if base_url not in found_urls:
                            found_urls.append(base_url)
                            print(f"[REQUESTS_SEARCH] 🌐 Found: {base_url}")
            
            return found_urls[:5]
    
    except Exception as e:
        print(f"[REQUESTS_SEARCH] ❌ Failed: {e}")
    
    return []


def fallback_episode_search(subdomain, episode_title, episode_number):
    """Fallback episode search without Selenium - scrape actual episode pages"""
    search_urls = []
    base_url = f"https://{subdomain}.fandom.com"
    
    try:
        # Try multiple common episode list page patterns
        episode_pages_to_try = [
            f"{base_url}/wiki/Episodes",
            f"{base_url}/wiki/Episode_Guide", 
            f"{base_url}/wiki/List_of_Episodes",
            f"{base_url}/wiki/Episode_List",
            f"{base_url}",  # Main page
        ]
        
        for page_url in episode_pages_to_try:
            try:
                print(f"[FALLBACK_EPISODE] 📄 Checking: {page_url}")
                response = requests.get(page_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }, timeout=10)
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for episode links more specifically
                    for link in soup.find_all('a', href=True):
                        href = link['href']
                        link_text = link.get_text().strip().lower()
                        
                        # Skip if it's clearly not an episode page
                        if any(skip in href.lower() for skip in ['episode_guide', 'episodes', 'list_of_episodes', 'category', 'template']):
                            continue
                        
                        # Must be a wiki link
                        if '/wiki/' not in href:
                            continue
                            
                        # Build full URL
                        full_url = f"{base_url}{href}" if href.startswith('/') else href
                        
                        # Check if this looks like an episode page
                        is_episode_link = False
                        
                        # Method 1: Check href for episode patterns
                        if any(pattern in href.lower() for pattern in ['episode_', 'ep_', '/ep', 'episode-']):
                            is_episode_link = True
                        
                        # Method 2: Check link text for episode indicators
                        if episode_number:
                            episode_num = str(episode_number).strip()
                            if episode_num in link_text or f"episode {episode_num}" in link_text:
                                is_episode_link = True
                        
                        # Method 3: Check for episode title match
                        if episode_title:
                            title_lower = episode_title.lower()
                            # Check both exact and partial matches
                            if title_lower in link_text or any(word in link_text for word in title_lower.split() if len(word) > 3):
                                is_episode_link = True
                        
                        # Method 4: Check for general episode patterns in link text
                        if any(pattern in link_text for pattern in ['episode', 'ep ', 'chapter']):
                            # Make sure it has a number
                            if re.search(r'\d+', link_text):
                                is_episode_link = True
                        
                        if is_episode_link and full_url not in search_urls:
                            search_urls.append(full_url)
                            print(f"[FALLBACK_EPISODE] 🔗 Found episode link: {full_url} (text: '{link_text[:50]}')")
                            
                            if len(search_urls) >= 15:  # Limit per page
                                break
                
                time.sleep(0.5)  # Small delay between pages
                        
            except Exception as e:
                print(f"[FALLBACK_EPISODE] ⚠️ Error with {page_url}: {e}")
                continue
    
    except Exception as e:
        print(f"[FALLBACK_EPISODE] ❌ Error: {e}")
    
    # Remove duplicates and limit results
    unique_urls = list(dict.fromkeys(search_urls))
    print(f"[FALLBACK_EPISODE] 📊 Found {len(unique_urls)} potential episode URLs")
    return unique_urls[:20]

def get_anime_series_links(subdomain):
    """
    Extract anime series links from the navigation dropdown menu
    """
    try:
        base_url = f"https://{subdomain}.fandom.com"
        print(f"[ANIME_LINKS] 📄 Scraping navigation from: {base_url}")
        
        response = requests.get(base_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, timeout=10)
        
        if response.status_code != 200:
            print(f"[ANIME_LINKS] ❌ Failed to fetch page: {response.status_code}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        anime_links = []
        
        # Look for navigation dropdown with anime links
        # Target the specific structure with nested dropdowns containing "Anime" 
        anime_sections = soup.find_all('li', class_='wds-dropdown-level-nested')
        
        for section in anime_sections:
            # Look for the toggle link that contains "Anime"
            toggle_link = section.find('a', class_='wds-dropdown-level-nested__toggle')
            if toggle_link:
                toggle_text = toggle_link.get_text(strip=True).lower()
                if 'anime' in toggle_text:
                    print(f"[ANIME_LINKS] 🎯 Found anime section: {toggle_text}")
                    
                    # Find the content div with the actual anime series links
                    content_div = section.find('div', class_='wds-dropdown-level-nested__content')
                    if content_div:
                        # Get all links within this section
                        links = content_div.find_all('a', href=True)
                        
                        for link in links:
                            href = link.get('href', '').strip()
                            title = link.find('span')
                            
                            if title and href:
                                title_text = title.get_text(strip=True)
                                
                                # Build full URL if it's relative
                                if href.startswith('/'):
                                    full_url = f"{base_url}{href}"
                                elif href.startswith('http'):
                                    full_url = href
                                else:
                                    continue
                                
                                # Skip if it's clearly not an anime series page
                                if any(skip in href.lower() for skip in ['category:', 'template:', 'help:']):
                                    continue
                                
                                anime_links.append({
                                    'title': title_text,
                                    'url': full_url
                                })
                                
                                print(f"[ANIME_LINKS] 📚 Found: {title_text} -> {full_url}")
        
        # If no specific anime section found, try alternative approaches
        if not anime_links:
            print("[ANIME_LINKS] 🔍 No anime dropdown found, trying alternative methods...")
            
            # Look for any navigation links that might be anime series
            all_nav_links = soup.find_all('a', href=True)
            
            for link in all_nav_links:
                href = link.get('href', '').strip()
                text = link.get_text(strip=True)
                
                # Skip empty or irrelevant links
                if not text or len(text) < 3:
                    continue
                
                # Look for patterns that suggest anime series
                if (('/wiki/' in href and 
                    not any(skip in href.lower() for skip in [
                        'category:', 'template:', 'help:', 'episode_guide', 'episodes', 'list'
                    ]) and
                    any(indicator in text.lower() for indicator in [
                        'anime', 'series', 'season', 'arc'
                    ]))):
                    
                    # Build full URL
                    if href.startswith('/'):
                        full_url = f"{base_url}{href}"
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        continue
                    
                    anime_links.append({
                        'title': text,
                        'url': full_url
                    })
                    
                    print(f"[ANIME_LINKS] 📚 Alternative find: {text} -> {full_url}")
                    
                    # Limit alternative results
                    if len(anime_links) >= 10:
                        break
        
        # Remove duplicates based on URL
        unique_links = []
        seen_urls = set()
        
        for link in anime_links:
            if link['url'] not in seen_urls:
                seen_urls.add(link['url'])
                unique_links.append(link)
        
        print(f"[ANIME_LINKS] ✅ Found {len(unique_links)} unique anime series links")
        return unique_links
        
    except Exception as e:
        print(f"[ANIME_LINKS] ❌ Error: {e}")
        return []
    
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


def url_exists(url):
    try:
        response = requests.head(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        return response.status_code == 200
    except Exception:
        return False


def clean_for_url(text):
    """
    Clean text for URL formatting (similar to MediaWiki URL encoding)
    """
    if not text:
        return ""
    
    # Replace spaces with underscores
    cleaned = text.replace(' ', '_')
    
    # Remove or replace problematic characters
    cleaned = re.sub(r'[<>"\[\]{}|\\^]', '', cleaned)
    
    # Handle special characters that are usually URL encoded
    cleaned = cleaned.replace('?', '%3F')
    cleaned = cleaned.replace('#', '%23')
    cleaned = cleaned.replace('&', '%26')
    
    return cleaned


def test_episode_url(url, episode_title="", episode_number=""):
    """
    Test if a Fandom episode URL is valid, matches the expected episode, AND contains chapter information
    """
    try:
        response = requests.get(url, timeout=8, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        })
        
        if response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, 'html.parser')

        # Get page content for analysis
        title_text = soup.title.get_text().lower() if soup.title else ''
        heading_text = soup.find('h1').get_text().lower() if soup.find('h1') else ''

        # Reject common non-episode pages
        rejection_keywords = [
            'episode guide', 'episode list', 'episodes', 'list of episodes',
            'disambiguation', 'search results', 'category:', 'season'
        ]
        
        if any(keyword in title_text or keyword in heading_text for keyword in rejection_keywords):
            print(f"[TEST_URL] ❌ Rejected - appears to be a guide/list page: {url}")
            return False

        # Look for episode-specific indicators
        episode_indicators = []
        
        if episode_number:
            num = int(re.search(r'\d+', str(episode_number)).group())
            episode_indicators.extend([
                f"episode {num}",
                f"episode_{num}",
                f"ep {num}",
                f"ep_{num}"
            ])

        if episode_title:
            clean_title = episode_title.lower()
            clean_title = re.sub(r'^(vs\.?\s*|episode\s*\d*:?\s*)', '', clean_title).strip()
            title_parts = [part.strip() for part in re.split(r'[:/\-"\']', clean_title) if part.strip() and len(part.strip()) > 2]
            episode_indicators.extend(title_parts)

        # Check if any episode indicators are found
        found_match = False
        for indicator in episode_indicators:
            if indicator in title_text or indicator in heading_text or indicator in url.lower():
                found_match = True
                print(f"[TEST_URL] ✅ Found match for '{indicator}' in: {url}")
                break

        if not found_match:
            print(f"[TEST_URL] ❌ No episode match found in: {url}")
            return False

        # NEW: Check if the page contains chapter information
        chapters = extract_chapter_info(soup)
        if not chapters:
            print(f"[TEST_URL] ❌ No chapter information found in: {url}")
            return False
        
        print(f"[TEST_URL] ✅ Found {len(chapters)} chapters in: {url}")
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
    Extract chapter information from the episode page using specific div targeting.
    Works on Fandom-style infoboxes, accounting for chapters or manga references.
    """

    # Match all blocks that might contain data entries
    data_blocks = soup.find_all("div", class_=lambda c: c and "pi-item" in c and "pi-data" in c)

    chapters = []
    for block in data_blocks:
        # Get the label (e.g., "Chapter", "Manga Chapter", etc.)
        label_tag = block.find("h3", class_=lambda c: c and "pi-data-label" in c)
        value_div = block.find("div", class_=lambda c: c and "pi-data-value" in c)

        if not label_tag or not value_div:
            continue  # Skip if key elements are missing

        label_text = label_tag.get_text(strip=True).lower()
        if "chapter" in label_text or "manga" in label_text:
            a_tags = value_div.find_all("a")
            if a_tags:
                for a in a_tags:
                    text = a.get_text(strip=True)
                    numbers = re.findall(r'\d+(?:\.\d+)?[a-zA-Z]?', text)
                    chapters.extend(numbers or [text])
            else:
                # No <a> tags, fallback to raw text
                text = value_div.get_text(strip=True)
                numbers = re.findall(r'\d+(?:\.\d+)?[a-zA-Z]?', text)
                chapters.extend(numbers or [text])

    # Remove duplicates while preserving order
    chapters = list(dict.fromkeys(chapters))

    print("Extracted Chapters (or related tags):")
    print(chapters)

    return chapters


def find_fandom_wiki_direct(anime_name):
    """Try to find anime wiki by constructing likely URLs - returns immediately when valid URL found"""
    print(f"[DIRECT] 🎯 Trying direct URL construction for: {anime_name}")
    
    # Create multiple variations of the anime name
    variations = create_url_variations(anime_name)
    
    for variation in variations:
        # Test the main fandom URL pattern
        test_url = f"https://{variation}.fandom.com"
        print(f"[DIRECT] 🔗 Testing: {test_url}")
        
        if test_url_exists(test_url):
            print(f"[DIRECT] ✅ FOUND: {test_url}")
            # Immediately test validation
            if validate_anime_wiki(test_url, anime_name):
                print(f"[DIRECT] ✅ VALIDATED: {test_url}")
                return test_url  # Return immediately when both exist and validate
            else:
                print(f"[DIRECT] ❌ Failed validation: {test_url}")
    
    print("[DIRECT] ❌ No valid direct URLs found")
    return None  # Return None if no valid URL found


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
        'haikyuu second season': ['haikyuu'],  # Fixed: Use main haikyuu wiki
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

def validate_anime_wiki(url, anime_title):
    """Simplified validation by checking for Fandom wiki page structure"""
    try:
        response = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        if response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for the specific Fandom wiki page header structure
        page_header = soup.find('div', class_='page-header__title-wrapper')
        if page_header:
            title_element = page_header.find('h1', class_='page-header__title')
            if title_element:
                print(f"[VALIDATE] ✅ Found valid Fandom wiki structure for: {url}")
                return True
        
        print(f"[VALIDATE] ❌ No valid Fandom wiki structure found for: {url}")
        return False

    except Exception as e:
        print(f"[VALIDATE] ❌ Error validating {url}: {e}")
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
    import os
    port = int(os.environ.get('PORT', 8181))
    app.run(host='0.0.0.0', port=port, debug=False)
else:
    application = app