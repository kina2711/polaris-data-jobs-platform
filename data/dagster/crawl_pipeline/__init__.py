import os

from dagster import Definitions, load_assets_from_package_module
from dagster_dbt import DbtCliResource

from . import assets
from .resources.minio_resource import MinioResource
from .resources.postgres_resource import PostgresResource

all_assets = load_assets_from_package_module(assets)

dbt_project_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dbt_project")

defs = Definitions(
    assets=all_assets,
    resources={
        "minio": MinioResource(),
        "postgres": PostgresResource(),
        "dbt": DbtCliResource(project_dir=dbt_project_dir),
    },
)
