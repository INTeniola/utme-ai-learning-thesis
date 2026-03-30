from bs4 import BeautifulSoup
import urllib.request

url = "https://myschool.ng/past-questions?exam=UTME&subject=Mathematics&year=2022"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

soup = BeautifulSoup(html, 'html.parser')

print("Page Title:", soup.title.string)

# Inspect how questions are laid out
questions = soup.select('.question-list .question')  # Hypothetical selectors
if not questions:
    questions = soup.select('.media') # common layout

for i, q in enumerate(questions[:2]):
    print(f"--- Q{i+1} ---")
    print("Class:", q.get('class'))
    print("Text:", q.text[:100].strip().replace('\n', ' '))
