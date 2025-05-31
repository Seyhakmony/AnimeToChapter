from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, urlparse, unquote

app = Flask(__name__)
CORS(app)

@app.route("/search-anime-wiki", methods=["POST"])
@app.route('/search-anime-wiki', methods=['POST'])
def search_anime_wiki():
    try:
        data = request.get_json()

        if not data or 'anime_name' not in data:
            return jsonify({"success": False, "error": "Missing 'anime_name' in request"}), 400

        anime_name = data['anime_name'].strip()
        if not anime_name:
            return jsonify({"success": False, "error": "Empty anime name"}), 400

        print("Searching fandom wiki for:", anime_name)
        # Continue with search logic...
        # return jsonify({"success": True, "url": found_url, "source": "google"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def web_search_fandom(anime_name):
    try:
        search_query = f'"{anime_name}" wiki site:fandom.com'
        encoded_query = quote_plus(search_query)
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = requests.get(search_url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        links = soup.find_all('a', href=True)

        found_urls = []
        for link in links:
            href = link['href']
            if 'uddg=' in href:
                try:
                    href = unquote(href.split('uddg=')[1].split('&')[0])
                except Exception:
                    continue

            if (href.startswith('http') and 
                'fandom.com' in href and
                not any(x in href for x in ['/Special:', '/User:', '/File:', '/Category:', '/Talk:'])):

                parsed = urlparse(href)
                base_url = f"{parsed.scheme}://{parsed.netloc}"

                if base_url not in found_urls:
                    found_urls.append(base_url)
                    print(f"[CANDIDATE] Found URL: {base_url}")

            if len(found_urls) >= 5:
                break

        return found_urls

    except Exception as e:
        print(f"[ERROR] Web search failed: {e}")
        return []


def validate_anime_wiki(url, anime_title):
    try:
        response = requests.get(url, timeout=8, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        if response.status_code != 200:
            print(f"[VALIDATION] Failed status code {response.status_code} for {url}")
            return False

        soup = BeautifulSoup(response.text, 'html.parser')
        page_title = soup.title.string.lower() if soup.title else ""

        main_content = ""
        for cls in ['page-content', 'mw-content-text', 'WikiaArticle']:
            div = soup.find('div', class_=cls)
            if div:
                main_content = div.get_text().lower()
                break

        cleaned_anime = re.sub(r'[^a-zA-Z0-9\s]', '', anime_title).lower()
        cleaned_page_title = re.sub(r'[^a-zA-Z0-9\s]', '', page_title).lower()

        anime_words = [word for word in cleaned_anime.split() if len(word) > 2]
        title_match = any(word in cleaned_page_title for word in anime_words)
        content_match = any(word in main_content for word in anime_words)
        is_wiki = 'wiki' in page_title

        valid = (title_match or content_match) and is_wiki
        print(f"[VALIDATION] {url} - Title match: {title_match}, Content match: {content_match}, Is wiki: {is_wiki}, Result: {valid}")

        return valid

    except Exception as e:
        print(f"[ERROR] Validation failed for {url}: {e}")
        return False


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Anime Wiki Finder API is running'})


if __name__ == '__main__':
    print("Starting Anime Wiki Finder API...")
    print("Available endpoints:")
    print("  POST /search-anime-wiki - Find anime fandom wiki")
    print("  GET  /health - Health check")
    app.run(debug=True, port=5000)
