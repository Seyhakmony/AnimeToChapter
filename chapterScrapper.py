import requests
from bs4 import BeautifulSoup
import re

url = "https://naruto.fandom.com/wiki/You_Failed!_Kakashi's_Final_Decision"
url = "https://dragonball.fandom.com/wiki/The_New_Threat"

url = "https://kurokonobasuke.fandom.com/wiki/It%27s_Better_if_I_Can%27t_Win"
# url = "https://haikyuu.fandom.com/wiki/The_Formidable_Ally_(Episode)"

response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# Find all divs that contain the relevant links
chapter_divs = soup.find_all("div", class_="pi-data-value pi-font")
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