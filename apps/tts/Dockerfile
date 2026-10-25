FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/cache \
    HOME=/home/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential espeak-ng libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/tts/requirements.txt ./requirements.txt
# Pin the CUDA torch build so the second install cannot swap it for a PyPI (CPU/other) build.
RUN printf 'torch==2.8.0+cu128\ntorchaudio==2.8.0+cu128\n' > /app/constraints.txt \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu128 --extra-index-url https://pypi.org/simple \
        -r /app/constraints.txt \
    && pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cu128 \
        -c /app/constraints.txt -r requirements.txt

# Run as non-root. /cache is normally a bind mount (see docker-compose.yml); the
# host directory must be writable by uid 1000 on Linux hosts.
RUN useradd --uid 1000 --create-home --home-dir /home/app --shell /usr/sbin/nologin app \
    && mkdir -p /cache \
    && chown app:app /cache

COPY apps/tts/server.py ./server.py
USER app
EXPOSE 8080
CMD ["python", "server.py"]
