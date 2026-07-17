import os

import requests
from dagster import AssetExecutionContext, AssetKey, Failure, MaterializeResult, asset


@asset(
    deps=[AssetKey("dim_jobs_clean")],
    key_prefix=["ai"],
    name="vectorize_jobs",
    group_name="ai_matching",
)
def vectorize_jobs(context: AssetExecutionContext):
    """Triggers the Vectorizer API built in Next.js to embed newly crawled jobs."""
    context.log.info("Triggering vectorizer API...")
    url = os.environ.get("VECTORIZER_API_URL", "http://web:3400/api/vectorize")
    token = os.environ.get("INTERNAL_VECTORIZER_TOKEN")
    if not token:
        raise Failure("INTERNAL_VECTORIZER_TOKEN is not configured")

    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=300,
        )
        response.raise_for_status()
        result = response.json()
        context.log.info(f"Vectorizer result: {result}")
        return MaterializeResult(metadata={"vectors_updated": result.get("updated", 0)})
    except Exception as e:
        raise Failure(f"Failed to vectorize jobs: {e}") from e
