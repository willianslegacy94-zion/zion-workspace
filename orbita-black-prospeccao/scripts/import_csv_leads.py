"""Reimporta leads de um CSV (mesmo formato da carteira de clientes original) pro schema
multi-tenant atual. Uso: python scripts/import_csv_leads.py <caminho.csv> <tenant_id>"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from repositories import leads_repo  # noqa: E402


def importar(caminho_csv: str, tenant_id: str = "orbita") -> int:
    df = pd.read_csv(caminho_csv)
    inseridos = 0

    for _, row in df.iterrows():
        email = row.get("E-mail Admin")
        nome = row.get("Contrato - Contato")
        nome = str(nome).strip() if pd.notna(nome) and str(nome).strip() else "Gestor"
        telefone = row.get("Telefone")

        if pd.isna(email) or pd.isna(telefone):
            continue

        existing = leads_repo.get_lead_by_phone(tenant_id, str(telefone).strip())
        if existing:
            continue

        leads_repo.create_lead(
            tenant_id, nome, str(telefone).strip(), source="csv_import",
            notes=f"email original: {str(email).strip().lower()}",
        )
        inseridos += 1

    return inseridos


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/import_csv_leads.py <caminho.csv> [tenant_id=orbita]")
        sys.exit(1)
    csv_path = sys.argv[1]
    tenant = sys.argv[2] if len(sys.argv) > 2 else "orbita"
    total = importar(csv_path, tenant)
    print(f"{total} leads importados para o tenant '{tenant}'.")
