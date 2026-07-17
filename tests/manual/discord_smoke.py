"""Manual Discord webhook smoke test.

Run only with an explicitly provided DISCORD_WEBHOOK_URL. This file is not an
automated test and must never contain a real credential.
"""

import os

import requests


def main() -> None:
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        raise SystemExit("DISCORD_WEBHOOK_URL is required")

    response = requests.post(
        webhook_url,
        json={
            "username": "Polaris Data Jobs Bot",
            "content": "Polaris Discord integration smoke test.",
        },
        timeout=15,
    )
    response.raise_for_status()
    print("Discord webhook smoke test succeeded.")


if __name__ == "__main__":
    main()
