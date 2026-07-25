# tools/calendar_mock.py
import datetime

# Dicionário em memória simulando os horários já ocupados na agenda
AGENDA_OCUPADA = [
    "2026-06-25 14:00",
    "2026-06-25 15:00"
]

def checar_disponibilidade_agenda(data_com_hora: str) -> str:
    """
    Verifica se uma data e hora específica está livre no calendário.
    Formato esperado do argumento: 'YYYY-MM-DD HH:MM' (Ex: '2026-06-25 14:00')
    """
    print(f"⚙️ TOOL EXECUTION: Claude acionou 'checar_disponibilidade_agenda' para {data_com_hora}")
    if data_com_hora in AGENDA_OCUPADA:
        return f"Indisponível. O horário {data_com_hora} já está ocupado por outro cliente."
    return f"Disponível. O horário {data_com_hora} está totalmente livre para agendamento."

def confirmar_agendamento_call(nome_cliente: str, email: str, data_com_hora: str) -> str:
    """
    Realiza o registro definitivo da mentoria ou reunião no calendário.
    Formato da data: 'YYYY-MM-DD HH:MM'
    """
    print(f"🔥 TOOL EXECUTION: Claude executou 'confirmar_agendamento_call' para {nome_cliente}")
    AGENDA_OCUPADA.append(data_com_hora)
    return f"Sucesso! Reunião agendada para {nome_cliente} ({email}) no dia/hora {data_com_hora}. Um convite lúdico foi disparado."
