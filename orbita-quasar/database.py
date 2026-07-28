# database.py
import sqlite3

DATABASE_NAME = "orbita_quasar.db"

# Dados por unidade usados tanto no texto do FAQ (abaixo) quanto na decisão
# de mandar a foto da barbearia (main.py, webhook_evolution) — mesma fonte
# pros dois, pra não duplicar o link/endereço em lugares que podem divergir.
# `endereco_match` é um trecho curto e estável do endereço (não o endereço
# completo) porque o modelo parafraseia a resposta — combinar contra o
# endereço inteiro com CEP quase nunca bateria.
UNIDADES_INFO = {
    "mutinga": {
        "booksy_url": "https://booksy.com/pt-br/dl/show-business/101380",
        "endereco_match": "Abelardo Luz",
        "imagem_url": "https://barbeariatl.online/barbearia-mutinga.jpg",
    },
    "tambore": {
        "booksy_url": "https://booksy.com/pt-br/dl/show-business/361149",
        "endereco_match": "Av. Ceci",
        "imagem_url": None,  # ainda sem foto cadastrada desta unidade
    },
}

# Conteúdo de negócio da Barbearia Thieco Leandro — fonte: documento de
# onboarding (persona, endereços, equipe, Booksy, regras de atendimento) +
# tabela de preços real consultada em produção (catalogo.preco_venda,
# somente leitura) em 2026-07-27. Preços do documento de onboarding foram
# descartados por estarem desatualizados — usar sempre a consulta ao banco
# como fonte de preço, não o PDF.
#
# Separado em bloco comum + bloco por unidade: cada unidade (Mutinga,
# Tamboré) vira uma linha própria em tenants_config, e o faq_contexto de
# cada uma só contém os dados daquela unidade. Isso não é só uma instrução
# no prompt — o agente conectado no número da Mutinga literalmente não
# recebe o endereço, equipe, Booksy ou preços da Tamboré (e vice-versa).
FAQ_THIECO_COMUM = """
PERSONA
- Nome do assistente: Thieco
- Tom de voz: direto e objetivo
- Emojis: usar com moderação, apenas para organizar o texto

HORÁRIO DE FUNCIONAMENTO
Terça a quinta: 09h às 20h | Sexta e sábado: 09h às 19h | Domingo e feriados: fechado

REGRAS DE ATENDIMENTO
- Tolerância de atraso: 10 minutos. Depois disso o horário pode ser redistribuído.
- Formas de pagamento: cartão e Pix.
- NUNCA prometa horário sem verificar o link de agendamento do Booksy.
- NUNCA confirme disponibilidade sem consultar o Booksy.
- NUNCA informe preços que não estejam nesta lista.
- Quando o cliente mencionar um serviço específico, pergunte se ele quer mais algum e ofereça um serviço complementar ou semelhante da tabela de preços (ex.: quem pergunta de corte, ofereça o combo com barba; quem pergunta de barba, ofereça sobrancelha ou hidratação de barba). Seja natural, não insistente — uma sugestão só, sem repetir se o cliente não demonstrar interesse.
- SÓ envie o link do Booksy quando o cliente pedir explicitamente para agendar/marcar um horário. Não mande esse link (nem o de Google Maps ou Instagram) espontaneamente em respostas sobre preço, serviço ou dúvida geral — o WhatsApp gera uma prévia com imagem pra cada link, e isso polui a conversa quando não é o que o cliente pediu.

TRANSBORDO PARA HUMANO
Quando o cliente pedir para falar com uma pessoa, tiver uma reclamação, ou uma dúvida que você não consegue responder com as informações acima: primeiro execute a ferramenta acionar_atendimento_humano (resumindo o motivo), e só depois responda ao cliente exatamente:
"Entendi! Vou te passar agora mesmo para o Thieco ou para o nosso gerente. Aguarde um instante que já te respondemos."
""".strip()

FAQ_THIECO_MUTINGA = f"""
UNIDADE: Jardim Mutinga
Você atende exclusivamente esta unidade — não fale sobre a unidade Tamboré / Alphaville.

ENDEREÇO
R. Abelardo Luz, 724, Jardim Mutinga, Barueri - SP, CEP 06463-260
Mapa: https://maps.google.com/?q=R.+Abelardo+Luz,+724+Barueri+SP

INSTAGRAM
@barbeariathiecoleandro

EQUIPE
Igor Hidalgo, Kauã dos Santos

ESTACIONAMENTO
Apenas via pública ou em frente à barbearia.

AGENDAMENTO (BOOKSY)
{UNIDADES_INFO["mutinga"]["booksy_url"]}
Links individuais por profissional não estão disponíveis — direcione sempre para o link geral acima.

TABELA DE PREÇOS (serviços e combos)
Corte: R$ 45,00 | Corte Infantil: R$ 45,00 | Barba: R$ 35,00 | Raspar Barba: R$ 20,00 | Raspar Cabelo: R$ 30,00
Sobrancelha: R$ 15,00 | Sobrancelha com Cera: R$ 20,00 | Risco: R$ 5,00 | Pezinho: R$ 15,00
Hidratação: R$ 25,00 | Hidratação Barba: R$ 20,00 | Limpeza de pele (facial): R$ 40,00
Depilação nariz: R$ 15,00 | Depilação orelha: R$ 15,00 | Depilação nariz + orelha: R$ 30,00
Selagem: R$ 57,00 | Progressiva: R$ 79,00 | Luzes: R$ 123,50 | Platinado: R$ 197,50
Combo - Corte + Barba: R$ 79,00 | Combo - Corte + Risco: R$ 55,00 | Combo - Corte + Sobrancelha: R$ 59,25
Combo - Corte + Sobrancelha com Cera: R$ 69,13 | Combo - Corte + Risco + Sobrancelha: R$ 69,13
Combo - Corte + Barba + Risco: R$ 88,88 | Combo - Corte + Barba + Sobrancelha: R$ 90,25
Combo - Corte + Progressiva: R$ 122,00
Dia de Princeso (Corte + Barba + Sobrancelha + Limpeza de pele e Depilação): R$ 138,25
Combo Novo - 4 Barbas: R$ 110,00 | Combo Novo - 2 Cortes + 2 Barbas + 2 Sobrancelha: R$ 150,00
Combo Novo - 4 Cortes + 4 Sobrancelha: R$ 190,00 | Combo Novo - 4 Cortes + 4 Barbas + 4 Sobrancelha: R$ 300,00
""".strip()

FAQ_THIECO_TAMBORE = f"""
UNIDADE: Tamboré / Alphaville
Você atende exclusivamente esta unidade — não fale sobre a unidade Jardim Mutinga.

ENDEREÇO
Av. Ceci, 205, Tamboré, Alphaville - SP, CEP 06460-120
Mapa: https://maps.google.com/?q=Av.+Ceci,+205,+Tambore+Barueri+SP

INSTAGRAM
@barbeariathiecotambore_

EQUIPE
Thieco Leandro (responsável)

ESTACIONAMENTO
Disponível no local.

AGENDAMENTO (BOOKSY)
{UNIDADES_INFO["tambore"]["booksy_url"]}
Links individuais por profissional não estão disponíveis — direcione sempre para o link geral acima.

TABELA DE PREÇOS (serviços e combos)
Corte: R$ 70,00 | Barba: R$ 60,00 | Raspar barba: R$ 30,00 | Raspar Cabelo: R$ 50,00
Sobrancelha: R$ 20,00 | Pezinho: R$ 20,00 | Hidratação: R$ 30,00 | Limpeza de pele (facial): R$ 50,00
Selagem: R$ 80,00 | Progressiva: R$ 120,00 | Luzes: R$ 150,00 | Platinado: R$ 250,00
Combo - Corte + Barba: R$ 130,00 | Combo - 3 Corte + 3 Barba + 3 Sobrancelha: R$ 300,00
""".strip()


def init_quasar_db():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # Configuração dos Tenants. Chave composta (tenant_id, unidade): tenants
    # com uma única localidade usam unidade='' (linha "padrão" do tenant);
    # tenants com múltiplas unidades (ex.: sistema_thieco) têm uma linha por
    # unidade, cada uma com seu próprio faq_contexto isolado.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tenants_config (
            tenant_id TEXT NOT NULL,
            unidade TEXT NOT NULL DEFAULT '',
            nome_empresa TEXT,
            faq_contexto TEXT,
            flag_agendamento_ia BOOLEAN DEFAULT 1,
            flag_fechamento_comercial BOOLEAN DEFAULT 0,
            PRIMARY KEY (tenant_id, unidade)
        )
    """)

    # Histórico de Conversas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historico_conversas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            tenant_id TEXT,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Piloto "atendimento ao cliente" — sistema-thieco (Barbearia Thieco
    # Leandro). Cliente é identificado por telefone (contato_cliente), não
    # e-mail — o contexto real (última visita, total de visitas, risco de
    # afastamento) vem do Órbita Cortex, não deste faq_contexto estático.
    # Agendamento e fechamento comercial ficam fora deste piloto de propósito
    # (próximas fatias reaproveitam o mesmo conector).
    for unidade, faq_unidade in (("mutinga", FAQ_THIECO_MUTINGA), ("tambore", FAQ_THIECO_TAMBORE)):
        cursor.execute("""
            INSERT OR REPLACE INTO tenants_config (tenant_id, unidade, nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "sistema_thieco",
            unidade,
            "Barbearia Thieco Leandro",
            f"{FAQ_THIECO_COMUM}\n\n{faq_unidade}",
            0,
            0
        ))

    conn.commit()
    conn.close()
    print("🚀 Banco de Dados do Agente Órbita Quasar Inicializado!")

if __name__ == "__main__":
    init_quasar_db()
