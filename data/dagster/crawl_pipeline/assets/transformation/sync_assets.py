from dagster import AssetExecutionContext, MaterializeResult, asset

@asset(
    deps=[
        "parsed_topcv_jobs_postgresql",
        "parsed_itviec_jobs_postgresql",
        "parsed_linkedin_jobs_postgresql",
    ],
    key_prefix=["public"],
    name="raw_jobs",
    group_name="transformation",
)
def raw_jobs_sync(context: AssetExecutionContext):
    """Consolidates all parsed jobs into the public.raw_jobs table for dbt to consume."""
    context.log.info("All raw jobs parsed and inserted into Postgres. Ready for dbt.")
    return MaterializeResult()
