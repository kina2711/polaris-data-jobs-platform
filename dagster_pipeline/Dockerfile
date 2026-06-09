FROM python:3.10-slim

RUN pip install \
    dagster \
    dagster-graphql \
    dagster-webserver \
    dagster-postgres \
    dagster-docker \
    pandas \
    beautifulsoup4 \
    requests \
    boto3 \
    minio \
    sqlalchemy \
    psycopg2-binary \
    curl_cffi \
    dbt-core \
    dbt-postgres \
    dagster-dbt

ENV DAGSTER_HOME=/opt/dagster/dagster_home
RUN mkdir -p $DAGSTER_HOME /opt/dagster/app

WORKDIR /opt/dagster/app

# Pre-compile the dbt project so the manifest.json is available for dagster_dbt
COPY dbt_project /opt/dagster/app/dbt_project
RUN cd dbt_project && dbt parse --profiles-dir . || true

EXPOSE 3000
