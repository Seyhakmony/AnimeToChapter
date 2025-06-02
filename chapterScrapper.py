import requests
from bs4 import BeautifulSoup
import re

url = "https://naruto.fandom.com/wiki/You_Failed!_Kakashi's_Final_Decision"
url = "https://dragonball.fandom.com/wiki/The_New_Threat"

url = "https://kurokonobasuke.fandom.com/wiki/It%27s_Better_if_I_Can%27t_Win"
url = "https://haikyuu.fandom.com/wiki/Direct_Sunlight"
# url = "https://haikyuu.fandom.com/wiki/The_Formidable_Ally_(Episode)"

response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# Find all divs that contain the relevant links
# chapter_divs = soup.find_all("div", class_="pi-data-value pi-font")
data_blocks = soup.find_all("div", class_=lambda c: c and "pi-item" in c)

chapters = []
for block in data_blocks:
    label_tag = block.find("h3", class_=lambda c: c and "pi-data-label" in c)
    value_div = block.find("div", class_=lambda c: c and "pi-data-value" in c)
    
    if not label_tag or not value_div:
        print("Skipping block due to missing label or value:")
        print(block.prettify())
        continue

    label_text = label_tag.get_text(strip=True).lower()
    if "chapter" in label_text or "manga" in label_text:
        a_tags = value_div.find_all("a")
        if a_tags:
            for a in a_tags:
                text = a.get_text(strip=True)
                numbers = re.findall(r'\d+(?:\.\d+)?[a-zA-Z]?', text)
                chapters.extend(numbers or [text])
        else:
            text = value_div.get_text(strip=True)
            numbers = re.findall(r'\d+(?:\.\d+)?[a-zA-Z]?', text)
            chapters.extend(numbers or [text])

# Remove duplicates
chapters = list(dict.fromkeys(chapters))
print("Extracted Chapters:")
print(chapters)