import requests
from bs4 import BeautifulSoup

url = "https://kurokonobasuke.fandom.com/wiki/I_Am_Serious"
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
        if text.lower().startswith("chapter") or text.isdigit():
            chapter_number = text.split()[-1]  # This will take the last part of "Chapter 2"
            if chapter_number.isdigit():
                chapters.append(chapter_number)

print("Extracted Chapters:")
print(chapters)