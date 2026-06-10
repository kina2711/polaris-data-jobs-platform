from dagster import AssetExecutionContext, MaterializeResult, asset
import requests
import os

@asset(
    deps=["dbt_transformation_assets"],
    key_prefix=["ai"],
    name="vectorize_jobs",
    group_name="ai_matching",
)
def vectorize_jobs(context: AssetExecutionContext):
    """Triggers the Vectorizer API built in Next.js to embed newly crawled jobs."""
    context.log.info("Triggering vectorizer API...")
    url = os.environ.get("VECTORIZER_API_URL", "http://crawl_web:3000/api/vectorizer")
    try:
        response = requests.post(url)
        response.raise_for_status()
        result = response.json()
        context.log.info(f"Vectorizer result: {result}")
        return MaterializeResult(metadata={"vectors_updated": result.get("updated", 0)})
    except Exception as e:
        context.log.error(f"Failed to vectorize jobs: {e}")
        return MaterializeResult(metadata={"error": str(e)})
