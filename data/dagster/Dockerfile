FROM python:3.10-slim

ENV DAGSTER_HOME=/opt/dagster/dagster_home
RUN mkdir -p $DAGSTER_HOME /opt/dagster/app

WORKDIR /opt/dagster/app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Dagster loads the manifest while importing Definitions. A parse failure must
# fail the image build instead of producing an image with a broken asset graph.
RUN cd dbt_project && dbt parse --profiles-dir .

EXPOSE 3000
