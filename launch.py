#!/usr/bin/env python3
"""Start Nordic Line with a loopback-only server; no packages to install."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import webbrowser
from bootstrap import ensure_vendor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    options = parser.parse_args()
    folder = Path(__file__).resolve().parent
    ensure_vendor(folder)
    server = ThreadingHTTPServer(('127.0.0.1', options.port), partial(SimpleHTTPRequestHandler, directory=str(folder)))
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Nordic Line is ready: {url}\nKeep this window open while playing. Press Ctrl+C to stop.', flush=True)
    if not options.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
