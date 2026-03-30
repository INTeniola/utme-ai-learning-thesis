import urllib.request
import json
import os
import sys

def search_github():
    url = "https://api.github.com/search/code?q=jamb+2021+OR+jamb+2022+OR+jamb+2023+extension:json"
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"Total found: {data.get('total_count')}")
            for item in data.get('items', [])[:5]:
                print(f"- {item['name']} in repo {item['repository']['full_name']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_github()
