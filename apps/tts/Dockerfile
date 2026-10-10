FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/tts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir torch==2.6.0 torchaudio==2.6.0 \
      --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY apps/tts/server.py ./server.py
EXPOSE 8080
CMD ["python", "server.py"]
