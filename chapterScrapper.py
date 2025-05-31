import requests
from bs4 import BeautifulSoup
import re

url = "https://naruto.fandom.com/wiki/You_Failed!_Kakashi's_Final_Decision"
url = "https://dragonball.fandom.com/wiki/Dragon_Ball_%28anime%29"

# url = "https://kurokonobasuke.fandom.com/wiki/It%27s_Better_if_I_Can%27t_Win"
# url = "https://haikyuu.fandom.com/wiki/The_Formidable_Ally_(Episode)"

response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# Find all divs that contain the relevant links
chapter_divs = soup.find_all("div", class_="pi-data-value pi-font")

chapters = []

for div in chapter_divs:
    a_tags = div.find_all("a")
    for a in a_tags:
        text = a.get_text(strip=True)
        
        # Use regex to extract numbers from chapter references
        if "chapter" in text.lower():
            # Extract numbers after "chapter" (handles both "Chapter 4" and "Chapter #6" formats)
            numbers = re.findall(r'\d+', text)
            if numbers:
                chapters.extend(numbers)  # Add all found numbers
        elif text.isdigit():
            # If the entire text is just a number
            chapters.append(text)

# Remove duplicates while preserving order
chapters = list(dict.fromkeys(chapters))

print("Extracted Chapters:")
print(chapters)