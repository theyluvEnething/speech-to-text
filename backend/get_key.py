import os
import json
import urllib.request

# Read .env file
env = {}
with open(".env") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v

api_key = env["DEEPGRAM_API_KEY"]
project_id = env["DEEPGRAM_PROJECT_ID"]

print(f"Project ID: {project_id}")
print(f"API Key:    {api_key[:12]}...{api_key[-4:]}")

url = f"https://api.deepgram.com/v1/projects/{project_id}/keys"
body = json.dumps({
    "comment": "Wavely Client Key (test)",
    "scopes": ["member"],
    "time_to_live_in_seconds": 21600,
}).encode()

req = urllib.request.Request(url, data=body, method="POST")
req.add_header("Authorization", f"Token {api_key}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(f"\nStatus: {resp.status}")
        print(f"Temp Key: {data.get('key', 'NOT FOUND')}")
        print(f"Full response:\n{json.dumps(data, indent=2)}")
except urllib.error.HTTPError as e:
    print(f"\nHTTP Error: {e.code}")
    print(f"Response: {e.read().decode()}")
except Exception as e:
    print(f"\nError: {e}")
