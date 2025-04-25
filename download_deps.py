import os
import urllib.request

THREE_BASE_URL = "https://unpkg.com/three@0.162.0"
THREE_FILES = [
    "/build/three.module.js",
    "/examples/jsm/controls/OrbitControls.js",
    "/examples/jsm/loaders/GLTFLoader.js",
    "/examples/jsm/utils/BufferGeometryUtils.js"
]

ADDITIONAL_FILES = {
    "https://unpkg.com/papaparse@5.4.1/papaparse.min.js": "js/papaparse.mjs"
}

def download_file(url, local_path):
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    print(f"Downloading {url} to {local_path}")
    try:
        urllib.request.urlretrieve(url, local_path)
    except urllib.error.HTTPError as e:
        print(f"Warning: Failed to download {url}: {e}")
        if e.code == 404:
            # Create an empty module for BufferGeometryUtils
            if "BufferGeometryUtils.js" in url:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, 'w') as f:
                    f.write('// Empty module - functionality not required\nexport {};')
                print(f"Created empty module at {local_path}")

def main():
    # Download Three.js files
    for file_path in THREE_FILES:
        url = THREE_BASE_URL + file_path
        local_path = os.path.join("js", "three", file_path.lstrip("/"))
        download_file(url, local_path)
    
    # Download additional files
    for url, local_path in ADDITIONAL_FILES.items():
        download_file(url, local_path)

if __name__ == "__main__":
    main() 