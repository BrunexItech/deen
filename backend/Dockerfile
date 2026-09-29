FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd --create-home --uid 10001 deen
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=deen:deen . .
USER deen
EXPOSE 8000
# Migrations run once before the API starts; scale API and worker replicas independently.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-4} --proxy-headers"]
