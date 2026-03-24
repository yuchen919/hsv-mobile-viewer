from __future__ import annotations

import argparse
import socket
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Serve the mobile HSV web app for local preview."
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind.")
    args = parser.parse_args()

    web_root = Path(__file__).resolve().parent / "mobile_web"
    handler = partial(SimpleHTTPRequestHandler, directory=str(web_root))
    server = ThreadingHTTPServer((args.host, args.port), handler)

    print(f"Serving: {web_root}")
    print(f"Desktop preview: http://127.0.0.1:{args.port}")
    print(f"LAN preview: http://{local_ip()}:{args.port}")
    print("Note: phone camera usually requires HTTPS or localhost in the browser.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
