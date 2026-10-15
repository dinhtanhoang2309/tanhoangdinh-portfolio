import http.server
import socketserver
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable caching for smooth instant frame replay
        if self.path.endswith('.jpg'):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def run():
    port = PORT
    for try_port in [3000, 8000, 5000, 8080]:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', try_port), CustomHTTPHandler)
            print(f"Serving at http://localhost:{try_port}", flush=True)
            server.serve_forever()
            break
        except OSError:
            continue

if __name__ == '__main__':
    run()
