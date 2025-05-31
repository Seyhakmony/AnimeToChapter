from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, urlparse
import time
from difflib import SequenceMatcher

app = Flask(__name__)
CORS(app)

# Expanded anime fandom wiki mappings
ANIME_WIKI_DATABASE = {
    # Basketball anime
    'kuroko no basket': 'kurokonobasuke.fandom.com',
    'kuroko\'s basketball': 'kurokonobasuke.fandom.com',
    'kuroko no basuke': 'kurokonobasuke.fandom.com',
    
    # Popular anime
    'naruto': 'naruto.fandom.com',
    'naruto shippuden': 'naruto.fandom.com',
    'one piece': 'onepiece.fandom.com',
    'dragon ball': 'dragonball.fandom.com',
    'dragon ball z': 'dragonball.fandom.com',
    'dragon ball super': 'dragonball.fandom.com',
    'attack on titan': 'attackontitan.fandom.com',
    'shingeki no kyojin': 'attackontitan.fandom.com',
    'demon slayer': 'kimetsu-no-yaiba.fandom.com',
    'kimetsu no yaiba': 'kimetsu-no-yaiba.fandom.com',
    'my hero academia': 'bokunoheroacademia.fandom.com',
    'boku no hero academia': 'bokunoheroacademia.fandom.com',
    'bleach': 'bleach.fandom.com',
    'jujutsu kaisen': 'jujutsu-kaisen.fandom.com',
    'tokyo ghoul': 'tokyoghoul.fandom.com',
    'hunter x hunter': 'hunterxhunter.fandom.com',
    'fairy tail': 'fairytail.fandom.com',
    'fullmetal alchemist': 'fma.fandom.com',
    'death note': 'deathnote.fandom.com',
    'code geass': 'codegeass.fandom.com',
    'neon genesis evangelion': 'evangelion.fandom.com',
    'evangelion': 'evangelion.fandom.com',
    'cowboy bebop': 'cowboybebop.fandom.com',
    'one punch man': 'onepunchman.fandom.com',
    'mob psycho 100': 'mobpsycho100.fandom.com',
    'sword art online': 'swordartonline.fandom.com',
    'sao': 'swordartonline.fandom.com',
    'tokyo revengers': 'tokyo-revengers.fandom.com',
    'haikyuu': 'haikyuu.fandom.com',
    'haikyu': 'haikyuu.fandom.com',
    'slam dunk': 'slamdunk.fandom.com',
    'pokemon': 'pokemon.fandom.com',
    'spirited away': 'studio-ghibli.fandom.com',
    'your name': 'kiminonawa.fandom.com',
    'chainsaw man': 'chainsaw-man.fandom.com',
    'spy x family': 'spy-x-family.fandom.com',
    'violet evergarden': 'violet-evergarden.fandom.com',
    'akame ga kill': 'akamegakill.fandom.com',
    'tokyo ghoul re': 'tokyoghoul.fandom.com',
    'black clover': 'blackclover.fandom.com',
    'fire force': 'fire-force.fandom.com',
    'assassination classroom': 'ansatsu-kyoushitsu.fandom.com',
    'parasyte': 'parasyte.fandom.com',
    'overlord': 'overlordmaruyama.fandom.com',
    'that time i got reincarnated as a slime': 'tensura.fandom.com',
    'mob psycho': 'mobpsycho100.fandom.com',
    'dr stone': 'dr-stone.fandom.com',
    'promised neverland': 'yakusokunoneverland.fandom.com',
    'seven deadly sins': 'nanatsu-no-taizai.fandom.com',
    'vinland saga': 'vinlandsaga.fandom.com',
    'steins gate': 'steins-gate.fandom.com'
}
@app.route("/search-anime-wiki", methods=["POST"])
def search_anime_wiki():
    try:
        anime_title = request.json.get("animeTitle", "").strip()
        print(f"[INFO] Searching for anime: {anime_title}")

        if not anime_title:
            return jsonify({"success": False, "error": "Anime title is required."}), 400

        # 1. Check static database first
        db_url = database_lookup(anime_title)
        if db_url:
            print(f"[HIT] Found in database: {db_url}")
            return jsonify({"success": True, "url": db_url})

        # 2. Use web search if not in database
        urls = web_search_fandom(anime_title)
        print(f"[INFO] Fetched {len(urls)} URL(s) from web search.")

        for url in urls:
            if validate_anime_wiki(url, anime_title):
                print(f"[FOUND] Valid fandom wiki: {url}")
                return jsonify({"success": True, "url": url})

        print(f"[MISS] No valid Fandom wiki found for: {anime_title}")
        return jsonify({"success": False, "error": "No valid Fandom wiki found."})

    except Exception as e:
        print(f"[ERROR] Internal error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


def database_lookup(anime_name):
    anime_lower = anime_name.lower().strip()

    if anime_lower in ANIME_WIKI_DATABASE:
        return f"https://{ANIME_WIKI_DATABASE[anime_lower]}"

    search_words = set(word for word in anime_lower.split() if len(word) > 2)

    best_match = None
    max_score = 0

    for db_key, domain in ANIME_WIKI_DATABASE.items():
        db_words = set(word for word in db_key.split() if len(word) > 2)
        common_words = search_words & db_words

        if common_words:
            score = len(common_words) / max(len(search_words), len(db_words))
            if score > max_score and score > 0.5:
                max_score = score
                best_match = f"https://{domain}"

    return best_match


def web_search_fandom(anime_name):
    try:
        search_query = f'"{anime_name} wiki" site:fandom.com inurl:wiki'
        encoded_query = quote_plus(search_query)
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        headers = {
            'User-Agent': 'Mozilla/5.0'
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

            if ('fandom.com' in href and
                href.startswith('http') and
                not any(x in href for x in ['/Special:', '/User:', '/File:', '/Category:'])):
                
                base = urlparse(href)
                base_url = f"{base.scheme}://{base.netloc}"

                if base_url not in found_urls:
                    found_urls.append(base_url)

            if len(found_urls) >= 5:
                break

        return found_urls

    except Exception as e:
        print(f"[ERROR] Web search failed: {e}")
        return []


def validate_anime_wiki(url, anime_title):
    try:
        response = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code != 200:
            return False

        soup = BeautifulSoup(response.text, 'html.parser')
        page_title = soup.title.string.lower() if soup.title else ""
        
        cleaned_title = re.sub(r'[^a-zA-Z0-9]', '', anime_title).lower()
        cleaned_page_title = re.sub(r'[^a-zA-Z0-9]', '', page_title)

        return cleaned_title in cleaned_page_title or anime_title.lower() in page_title
    except Exception as e:
        print(f"[ERROR] Validation failed for {url} | {e}")
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