import json
import os

import requests
from dagster import AssetExecutionContext, AssetKey, Failure, MaterializeResult, asset


@asset(
    deps=[AssetKey(["ai", "vectorize_jobs"])],
    key_prefix=["notification"],
    name="discord_notification",
    group_name="notifications",
)
def discord_notification(context: AssetExecutionContext):
    """Sends a notification to Discord after successful vectorization."""
    context.log.info("Sending Discord notification...")
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        context.log.warning("DISCORD_WEBHOOK_URL not set. Skipping notification.")
        return MaterializeResult(metadata={"status": "skipped_no_webhook"})

    embed = {
        "title": "✅ AI Vectorization Pipeline Completed",
        "description": "New jobs have been successfully crawled, transformed, and vectorized for semantic search.",
        "color": 3066993,
    }
    try:
        response = requests.post(
            webhook_url,
            data=json.dumps({"embeds": [embed]}),
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
        context.log.info("Discord notification sent.")
        return MaterializeResult(metadata={"status": "sent"})
    except Exception as e:
        raise Failure(f"Failed to send Discord notification: {e}") from e
