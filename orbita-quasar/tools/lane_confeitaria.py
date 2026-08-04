# tools/lane_confeitaria.py
#
# Conector do Quasar com o Lane Confeitaria (CRM + Agenda + Financeiro da
# Confeitaria Artesanal da Lane). Chama a API interna do sistema
# (`/api/internal/*`, ver orbita-black/arquitetura-lane-confeitaria) em vez
# de guardar qualquer sabor/preço/regra aqui — mesmo princípio já usado pro
# whitelabel (nenhum dado de negócio hardcoded do lado do agente).
import os
import requests

LANE_API_URL = os.getenv("LANE_CONFEITARIA_API_URL", "http://127.0.0.1:3002")
LANE_INTERNAL_KEY = os.getenv("LANE_CONFEITARIA_INTERNAL_KEY", "")


def _headers() -> dict:
    return {"X-Internal-Key": LANE_INTERNAL_KEY, "Content-Type": "application/json"}


def consultar_catalogo_bolos() -> str:
    """
    Consulta os sabores de bolo (com preço por kg, quando já definido pela
    Lane) e o menu de docinhos por cento. Nunca lança — falha de conexão
    vira uma mensagem que o próprio Claude pode repassar ao cliente.
    """
    print("⚙️ TOOL EXECUTION (lane): consultar_catalogo_bolos")
    try:
        resp = requests.get(f"{LANE_API_URL}/api/internal/catalogo", headers=_headers(), timeout=8)
        if not resp.ok:
            return f"Não consegui consultar o catálogo agora (HTTP {resp.status_code})."

        dados = resp.json()
        sabores = dados.get("sabores", [])
        com_preco = [s for s in sabores if s.get("precoPorKg") is not None]
        sem_preco = [s for s in sabores if s.get("precoPorKg") is None]

        linhas = [f"- {s['nome']}: R$ {s['precoPorKg']:.2f}/kg" for s in com_preco]
        texto = "SABORES COM PREÇO DEFINIDO:\n" + (
            "\n".join(linhas) if linhas else "(nenhum sabor com preço cadastrado ainda — avise o cliente que vai confirmar)"
        )
        if sem_preco:
            nomes = ", ".join(s["nome"] for s in sem_preco[:15])
            texto += f"\n\nSABORES SEM PREÇO DEFINIDO AINDA (NÃO informe valor destes, diga que vai confirmar): {nomes}"

        docinhos = dados.get("docinhos", [])
        if docinhos:
            texto += "\n\nDOCINHOS (por cento):\n" + "\n".join(
                f"- {d['nome']}: R$ {d['precoCento']:.2f}/cento" for d in docinhos
            )
        return texto
    except Exception as e:
        return f"Não consegui consultar o catálogo agora (erro de conexão: {e!r})."


def consultar_disponibilidade_agenda(dias: int = 14) -> str:
    """
    Consulta quais dos próximos N dias ainda têm vaga de produção (a Lane
    produz um número limitado de bolos por dia). Nunca prometer uma data sem
    checar aqui antes.
    """
    print(f"⚙️ TOOL EXECUTION (lane): consultar_disponibilidade_agenda({dias})")
    try:
        resp = requests.get(
            f"{LANE_API_URL}/api/internal/agenda",
            headers=_headers(),
            params={"dias": dias},
            timeout=8,
        )
        if not resp.ok:
            return f"Não consegui consultar a agenda agora (HTTP {resp.status_code})."

        dias_info = resp.json().get("disponibilidade", [])
        com_vaga = [d["data"] for d in dias_info if d["temVaga"]]
        cheios = [d["data"] for d in dias_info if not d["temVaga"]]

        texto = f"Dias com vaga de produção: {', '.join(com_vaga) if com_vaga else 'nenhum nos próximos dias consultados'}."
        if cheios:
            texto += f" Dias já sem vaga (NÃO ofereça): {', '.join(cheios)}."
        return texto
    except Exception as e:
        return f"Não consegui consultar a agenda agora (erro de conexão: {e!r})."


def consultar_cliente_por_contato(contato: str) -> str:
    """
    Verifica se o telefone de quem está conversando já é cliente da Lane e
    se já é recorrente — usado pra personalizar o atendimento, não pra
    decidir preço ou regra diferente.
    """
    print(f"⚙️ TOOL EXECUTION (lane): consultar_cliente_por_contato({contato})")
    try:
        resp = requests.get(
            f"{LANE_API_URL}/api/internal/clientes",
            headers=_headers(),
            params={"contato": contato},
            timeout=8,
        )
        if not resp.ok:
            return f"Não consegui consultar o cadastro agora (HTTP {resp.status_code})."

        cliente = resp.json().get("cliente")
        if not cliente:
            return "Este contato ainda não tem pedidos registrados — é um cliente novo."
        if cliente["recorrente"]:
            return f"Cliente recorrente: {cliente['nome']}, já com {cliente['totalPedidosConcluidos']} pedido(s) concluído(s) antes."
        return f"Cliente já cadastrado: {cliente['nome']}, {cliente['totalPedidosConcluidos']} pedido(s) concluído(s) até agora."
    except Exception as e:
        return f"Não consegui consultar o cadastro agora (erro de conexão: {e!r})."


def registrar_pedido(
    cliente_nome: str,
    cliente_contato: str,
    sabor_nomes: list,
    massa: str,
    peso_kg: float,
    data_entrega: str,
    valor_base: float,
    acrescimo_cartao: bool = False,
    acrescimo_glitter: bool = False,
    acrescimo_topper: bool = False,
    modelo_referencia: str = "",
) -> str:
    """
    Registra o pedido de verdade no sistema da Lane — só chamar depois de
    confirmar com o cliente: sabor(es) (até 2), massa, peso, data de entrega
    (com vaga já checada) e valor combinado. Cai na primeira fila do funil
    da Lane, exatamente como um pedido cadastrado manualmente por ela.
    """
    print(f"🔥 TOOL EXECUTION (lane): registrar_pedido para {cliente_nome} ({data_entrega})")
    try:
        cat_resp = requests.get(f"{LANE_API_URL}/api/internal/catalogo", headers=_headers(), timeout=8)
        sabores_disponiveis = (
            {s["nome"].strip().lower(): s["id"] for s in cat_resp.json().get("sabores", [])} if cat_resp.ok else {}
        )
        sabor_ids = [sabores_disponiveis[nome.strip().lower()] for nome in sabor_nomes if nome.strip().lower() in sabores_disponiveis]
        if not sabor_ids:
            return "Não encontrei o(s) sabor(es) informado(s) no catálogo — confirme o nome exato do sabor com o cliente e tente de novo."

        corpo = {
            "clienteNome": cliente_nome,
            "clienteContato": cliente_contato,
            "saborIds": sabor_ids,
            "massa": massa.strip().upper(),
            "pesoKg": peso_kg,
            "dataEntrega": data_entrega,
            "valorBase": valor_base,
            "acrescimoCartao": acrescimo_cartao,
            "acrescimoGlitter": acrescimo_glitter,
            "acrescimoTopper": acrescimo_topper,
            "modeloReferencia": modelo_referencia,
        }
        resp = requests.post(f"{LANE_API_URL}/api/internal/pedidos", headers=_headers(), json=corpo, timeout=10)

        if resp.status_code == 201:
            dados = resp.json()
            valor_final = dados.get("valorFinal")
            valor_sinal = dados.get("valorSinal")
            return (
                f"Pedido registrado com sucesso! Valor final: R$ {valor_final:.2f}. "
                f"Sinal de 50% a pagar agora: R$ {valor_sinal:.2f}. Restante na entrega."
            )
        return f"Não consegui registrar o pedido (HTTP {resp.status_code}): {resp.text}"
    except Exception as e:
        return f"Não consegui registrar o pedido agora (erro de conexão: {e!r})."


def registrar_progresso_atendimento(nome_cliente: str, contato_cliente: str, primeira_mensagem: bool) -> None:
    """
    Chamado automaticamente (não é ferramenta da IA) a cada mensagem de uma
    conversa — cria o card leve de "Atendimento" na fila inicial assim que
    um contato novo fala com a Mel pela 1ª vez, e avança pra fila "recebe da
    IA" (ex.: Em negociação) a partir da 2ª mensagem em diante. Nunca lança:
    é best-effort, uma falha aqui não pode travar a conversa.
    """
    if not contato_cliente:
        return
    try:
        requests.post(
            f"{LANE_API_URL}/api/internal/atendimentos/progresso",
            headers=_headers(),
            json={
                "clienteNome": nome_cliente,
                "clienteContato": contato_cliente,
                "primeiraMensagem": primeira_mensagem,
            },
            timeout=8,
        )
    except Exception as e:
        print(f"[quasar] falha ao registrar progresso do atendimento: {e!r}")


def cliente_em_atendimento_humano(contato_cliente: str) -> bool:
    """
    Verifica, AO VIVO (sem estado duplicado do lado do Quasar), se o cartão
    em aberto desse contato (Pedido ou ainda só Atendimento) já está na fila
    marcada como "atendimento humano". Enquanto estiver lá, a Mel fica em
    silêncio — só a Lane responde. Assim que ela mover o card pra outro
    lugar, a próxima consulta já reflete isso e a Mel volta a responder
    sozinha, sem nenhuma ação manual do lado do Quasar. Nunca lança: falha
    de conexão é tratada como "não está em atendimento humano" (a Mel
    continua respondendo, que é o comportamento mais seguro nesse caso).
    """
    try:
        filas_resp = requests.get(f"{LANE_API_URL}/api/internal/filas", headers=_headers(), timeout=8)
        if not filas_resp.ok:
            return False
        fila_humanizada = next(
            (f for f in filas_resp.json().get("filas", []) if f.get("disparaAtendimentoHumano")),
            None,
        )
        if not fila_humanizada:
            return False

        cartao_resp = requests.get(
            f"{LANE_API_URL}/api/internal/cartoes/aberto",
            headers=_headers(),
            params={"contato": contato_cliente},
            timeout=8,
        )
        if not cartao_resp.ok:
            return False
        cartao = cartao_resp.json().get("cartao")
        return bool(cartao) and cartao["filaId"] == fila_humanizada["id"]
    except Exception:
        return False


def acionar_atendimento_humano(contato_cliente: str, motivo: str) -> str:
    """
    Move o cartão em aberto do cliente (Pedido de verdade, ou ainda só o
    Atendimento da conversa em andamento) pra fila marcada como "atendimento
    humano" nas Configurações → Filas da Lane. Nunca hardcoda nome/UUID de
    fila — sempre resolve pelo flag via /api/internal/filas, mesmo princípio
    das outras ferramentas. Se não houver fila marcada, ou não houver
    nenhum cartão em aberto pra esse contato, apenas avisa (sem lançar) — a
    Lane sempre pode ser avisada manualmente por fora.
    """
    print(f"⚙️ TOOL EXECUTION (lane): acionar_atendimento_humano({contato_cliente})")
    try:
        filas_resp = requests.get(f"{LANE_API_URL}/api/internal/filas", headers=_headers(), timeout=8)
        if not filas_resp.ok:
            return f"Não consegui verificar as filas agora (HTTP {filas_resp.status_code}) — avise a Lane manualmente. Motivo: {motivo}"

        fila_destino = next(
            (f for f in filas_resp.json().get("filas", []) if f.get("disparaAtendimentoHumano")),
            None,
        )
        if not fila_destino:
            return f"Nenhuma fila de atendimento humano configurada ainda — avise a Lane manualmente. Motivo: {motivo}"

        if not contato_cliente:
            return f"Fila de atendimento humano configurada ('{fila_destino['nome']}'), mas sem contato do cliente pra localizar o cartão — avise a Lane manualmente. Motivo: {motivo}"

        cartao_resp = requests.get(
            f"{LANE_API_URL}/api/internal/cartoes/aberto",
            headers=_headers(),
            params={"contato": contato_cliente},
            timeout=8,
        )
        cartao = cartao_resp.json().get("cartao") if cartao_resp.ok else None
        if not cartao:
            return f"Cliente ainda não tem nenhum atendimento em aberto pra mover — avise a Lane manualmente. Motivo: {motivo}"

        mover_resp = requests.post(
            f"{LANE_API_URL}/api/internal/cartoes/{cartao['tipo']}/{cartao['id']}/mover",
            headers=_headers(),
            json={"filaId": fila_destino["id"]},
            timeout=8,
        )
        if mover_resp.ok:
            return f"Atendimento movido para a fila '{fila_destino['nome']}' — a Lane vai assumir a partir daqui."
        return f"Não consegui mover o atendimento agora (HTTP {mover_resp.status_code}) — avise a Lane manualmente. Motivo: {motivo}"
    except Exception as e:
        return f"Não consegui acionar o atendimento humano agora (erro de conexão: {e!r}) — avise a Lane manualmente. Motivo: {motivo}"


def confirmar_pagamento_sinal(contato_cliente: str, resumo_comprovante: str) -> str:
    """
    Sinaliza no card do pedido ("validar comprovante") que o cliente enviou
    um comprovante de Pix e a Mel conferiu visualmente que parece correto.
    NUNCA marca o sinal como pago sozinha — quem dá baixa de verdade,
    olhando o extrato real, é a Lane. Nunca lança.
    """
    print(f"⚙️ TOOL EXECUTION (lane): confirmar_pagamento_sinal({contato_cliente}) — {resumo_comprovante}")
    try:
        resp = requests.post(
            f"{LANE_API_URL}/api/internal/pedidos/confirmar-sinal",
            headers=_headers(),
            json={"contato": contato_cliente, "resumo": resumo_comprovante},
            timeout=8,
        )
        if resp.status_code == 404:
            return "Não encontrei nenhum pedido em aberto pra esse contato — confirme se o pedido já foi registrado antes de mandar o comprovante."
        if resp.ok:
            return "Comprovante registrado para a Lane validar (ela confere pelo extrato real e dá baixa)."
        return f"Não consegui registrar o comprovante agora (HTTP {resp.status_code})."
    except Exception as e:
        return f"Não consegui registrar o comprovante agora (erro de conexão: {e!r})."
