import os

from dagster import Definitions, load_assets_from_modules
from dagster_dbt import DbtCliResource

from . import assets

all_assets = load_assets_from_modules([assets])

dbt_project_dir = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "dbt_project"
)

defs = Definitions(
    assets=all_assets,
    resources={
        "dbt": DbtCliResource(project_dir=dbt_project_dir),
    },
)
