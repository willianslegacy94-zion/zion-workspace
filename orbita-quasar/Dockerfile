# ─────────────────────────────────────────────────────────
#  Órbita Quasar — FastAPI (Python)
# ─────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Usuário não-root para segurança (mesmo padrão do Cortex/backend do sistema-thieco)
RUN addgroup --system appgroup && \
    adduser  --system --ingroup appgroup appuser

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup . .

# COPY --chown só ajusta os arquivos copiados, não o diretório /app em si
# (criado por WORKDIR, ainda root:root) — sem isso o appuser não consegue
# criar o orbita_quasar.db na primeira vez (arquivo não é copiado pra
# imagem, ver .dockerignore).
RUN chown appuser:appgroup /app

USER appuser

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5003/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5003"]
