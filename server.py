from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def guess_type(self, path):
        # Add correct MIME types for JavaScript modules
        if path.endswith('.mjs'):
            return 'application/javascript'
        elif path.endswith('.js'):
            return 'application/javascript'
        return super().guess_type(path)

port = 8000
print(f"Starting server at http://localhost:{port}")
httpd = HTTPServer(('localhost', port), CORSRequestHandler)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server...")
    httpd.server_close()
    sys.exit(0) 