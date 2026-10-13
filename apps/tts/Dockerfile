FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential espeak-ng libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/tts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu128 --extra-index-url https://pypi.org/simple \
        torch==2.8.0+cu128 torchaudio==2.8.0+cu128 \
    && pip install --no-cache-dir -r requirements.txt

COPY apps/tts/server.py ./server.py
EXPOSE 8080
CMD ["python", "server.py"]
