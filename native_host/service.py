import argparse
from urllib.parse import urlparse

import uvicorn

from backend.main import create_app
from .__main__ import load_config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    url = urlparse(config["backend_url"])
    app = create_app(db_path=config["db_path"], api_token=config["token"], durable_execution=True)
    uvicorn.run(app, host=url.hostname, port=url.port or 80, workers=1)


if __name__ == "__main__":
    main()
