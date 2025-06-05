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

if __name__ == '__main__':
    app.run(debug=True)
