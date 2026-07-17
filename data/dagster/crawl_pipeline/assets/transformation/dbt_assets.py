import os

from dagster import AssetExecutionContext
from dagster_dbt import DbtCliResource, dbt_assets

dbt_project_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "dbt_project",
)


@dbt_assets(manifest=os.path.join(dbt_project_dir, "target", "manifest.json"))
def dbt_transformation_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()
