from flask import Flask, request, jsonify
from flask_cors import CORS  
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)
CORS(app)

@app.route('/checkurl', methods=['POST'])
def check_heading():
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        heading = soup.find('h1', {'class': 'page-header__title', 'id': 'firstHeading'})
        
        if heading and heading.text.strip() == 'Home':
            return jsonify({'found': True})
        else:
            return jsonify({'found': False})
    except Exception as e:
        return jsonify({'found': False, 'error': str(e)}), 500

@app.route('/getchapters', methods=['POST'])
def get_chapters():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        chapter_divs = soup.find_all("div", class_="pi-data-value pi-font")
        chapters = []

        for div in chapter_divs:
            a_tags = div.find_all("a")
            for a in a_tags:
                text = a.get_text(strip=True)
                if text.lower().startswith("chapter") or text.isdigit():
                    chapter_number = text.split()[-1]
                    if chapter_number.isdigit():
                        chapters.append(chapter_number)
        print(chapters)
        return jsonify({'chapters': chapters})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
