import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers import black_legacy, interactions, leads, meetings, whatsapp

init_db()

app = FastAPI(title="Órbita Black — Motor de Prospecção + CRM Conversacional")

app.include_router(leads.router)
app.include_router(interactions.router)
app.include_router(meetings.router)
app.include_router(whatsapp.router)
app.include_router(black_legacy.router)

# Sempre por último: Mount("/") casa qualquer prefixo que não bateu em nenhuma rota acima.
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=int(os.getenv("PORT", 5000)), reload=True)
