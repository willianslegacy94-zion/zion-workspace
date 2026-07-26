# ─────────────────────────────────────────────────────────
#  Órbita Cortex — FastAPI (Python)
# ─────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Usuário não-root para segurança (mesmo padrão do backend do sistema-thieco)
RUN addgroup --system appgroup && \
    adduser  --system --ingroup appgroup appuser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
