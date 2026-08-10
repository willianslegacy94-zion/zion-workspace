---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# status-promotion-rules

## proposito

define o lifecycle operacional de todos os artefatos do ecossistema kernel-hq.

status reflete maturidade operacional real — nao intencao nem esforco.
promocao depende de comportamento do sistema — nao de aprovacao subjetiva.

aplica-se a todos os artefatos de todos os sistemas: arquitetura-thieco, arquitetura-villamill, e sistemas futuros.

---

## tipos-de-artefato

todo artefato do ecossistema pertence a uma das quatro categorias abaixo.
as regras de promocao variam conforme o tipo.

### output-bruto
- origem: sessao de ia ou rascunho inicial
- destino: armazenado localmente como rascunho antes de revisao
- caracteristica: material nao validado
- nao pode virar artefato oficial automaticamente
- requer revisao e validacao de Willians antes de qualquer promocao
- exemplos: análises geradas por IA, especificações em rascunho, modelos não revisados

### contexto-consolidado
- origem: output validado e aprovado por Willians
- destino: pasta correspondente do sistema (ex: `arquitetura-thieco/`)
- caracteristica: estado vivo e atual do sistema
- serve como bootstrap para todas as ias
- pode ser alterado conforme o estado do sistema evolui
- exemplos: prd-thieco.md, requisitos-funcionais-thieco.md, arquitetura-thieco.md

### contrato-operacional
- origem: decisao arquitetural validada
- destino: `registro-de-decisoes-{sistema}.md` ou artefato específico
- caracteristica: define invariantes e fronteiras do sistema
- mudancas exigem justificativa arquitetural documentada
- exemplos: regras de comissão (RN-005), taxas PagBank por unidade (RN-004), comissão zero do dono (RN-006)

### runtime-protegido
- origem: comportamento validado e estabilizado em uso real
- destino: `requisitos-funcionais-{sistema}.md` como regra de negocio
- caracteristica: comportamento critico que nao pode regredir
- qualquer alteracao e tratada como regressao ate prova em contrario
- exemplos: calculo de comissao por tipo de item, valor liquido com taxas PagBank, isolamento de dados por papel de usuario

---

# status-system

## draft

### significado-operacional
exploracao inicial. o artefato existe mas nao foi validado.

### nivel-de-confiabilidade
baixo. conteudo e provisorio e altamente mutavel.

### objetivo
capturar ideia, analise ou estrutura inicial para revisao futura.

### comportamento-esperado
- pode ser alterado livremente
- nao deve ser usado como referencia por outros artefatos
- nao deve ser consumido por ias como contexto confiavel

### riscos-do-status
- ser tratado como contexto oficial antes da validacao
- permanecer em draft indefinidamente sem promocao ou descarte

### quando-usar
- outputs iniciais de ia antes de qualquer validacao
- ideias e exploracoes nao estruturadas
- estruturas que precisam de revisao antes de qualquer uso

### o-que-impede-promocao
- conteudo nao revisado por Willians
- ausencia de metadata-standard
- violacao de naming-convention
- conteudo contraditorio com artefatos approved ou stable

### requisitos-para-promocao-para-validating
- Willians revisou o conteudo
- conteudo e coerente com o sistema atual
- metadata-standard presente e correto
- naming-convention respeitada

### quem-pode-promover
- Willians (unico owner)

### validacao-empirica-necessaria
nao — revisao conceitual suficiente para sair de draft

---

## experimental

### significado-operacional
em teste operacional ativo. pode funcionar, mas ainda nao foi validado em condicoes reais suficientes.

### nivel-de-confiabilidade
baixo-medio. pode quebrar. nao confiar como referencia permanente.

### objetivo
testar hipotese operacional em condicao real antes de validar.

### comportamento-esperado
- pode ser alterado durante o periodo de teste
- deve ser monitorado ativamente
- resultados do teste devem ser documentados antes da promocao

### riscos-do-status
- feature critica sendo colocada em producao como experimental sem contrato de fallback
- permanecer experimental sem criterio de saida definido

### quando-usar
- funcionalidades ou sistemas em teste antes de validacao formal
- comportamentos novos que precisam de uso real para confirmar estabilidade

### requisitos-para-promocao-para-validating
- periodo de uso real sem regressao documentada
- comportamento consistente em todas as condicoes testadas
- nenhum sinal de regressao no periodo de observacao

### quem-pode-promover
- Willians

### validacao-empirica-necessaria
sim — uso real e obrigatorio para sair de experimental

---

## validating

### significado-operacional
funcionando em uso real mas ainda em observacao. feedback sendo coletado. confiavel o suficiente para referenciar, mas nao o suficiente para tratar como invariante.

### nivel-de-confiabilidade
medio. conteudo e operacional mas pode evoluir.

### objetivo
coletar feedback operacional real para confirmar ou refinar antes de aprovar.

### comportamento-esperado
- pode ser referenciado por outros artefatos com ressalva de mutabilidade
- alteracoes devem ser documentadas
- sinal de regressao ou inconsistencia deve bloquear promocao

### riscos-do-status
- artefato permanecendo em validating indefinidamente sem criterio de saida
- ser tratado como approved antes do tempo, gerando falsa seguranca

### requisitos-para-promocao-para-approved
- pelo menos um ciclo de uso operacional real sem regressao
- nenhum problema ativo relacionado ao artefato
- conteudo coerente com todos os contratos e dominios aprovados
- Willians validou explicitamente

### quem-pode-promover
- Willians

### validacao-empirica-necessaria
sim — pelo menos um ciclo de uso real

---

## approved

### significado-operacional
comportamento ou sistema aprovado. confiavel como referencia. nao deve ser alterado casualmente.

### nivel-de-confiabilidade
alto. pode ser consumido por ias como contexto confiavel.

### objetivo
marcar artefatos que passaram por validacao e podem ser usados como referencia operacional.

### comportamento-esperado
- pode ser consumido por ias sem ressalva
- alteracoes exigem justificativa documentada
- mudancas devem ser registradas em registro-de-decisoes-{sistema}.md
- violacoes sao tratadas como regressao

### o-que-impede-mudanca-sem-justificativa
qualquer mudanca em artefato approved exige:
- descricao da mudanca
- motivo arquitetural
- sistemas impactados
- atualizacao do campo `updated` no metadata
- entrada em registro-de-decisoes-{sistema}.md

### requisitos-para-promocao-para-stable
- multiplos ciclos de uso sem necessidade de alteracao
- nenhuma regressao registrada relacionada ao artefato
- comportamento consistente em todas as condicoes documentadas
- Willians avaliou que o artefato atingiu maturidade de invariante

### quem-pode-promover
- Willians

### validacao-empirica-necessaria
sim — multiplos ciclos

---

## stable

### significado-operacional
maturidade operacional consolidada. o artefato define um invariante do sistema. mudancas exigem justificativa arquitetural — nao apenas operacional.

### nivel-de-confiabilidade
muito alto. tratado como lei do sistema.

### objetivo
marcar artefatos que nao devem mais mudar sem razao arquitetural forte.

### comportamento-esperado
- tratado como invariante por todos os agentes e ias
- qualquer proposta de mudanca deve justificar impacto sistemico
- mudancas sao raras e sempre documentadas com impacto total
- nenhuma ia pode sugerir alteracao em stable sem declarar impacto completo

### o-que-impede-mudanca
mudancas em stable exigem:
- justificativa arquitetural documentada (nao apenas operacional)
- avaliacao de impacto em todos os dominios que dependem do artefato
- registro formal em registro-de-decisoes-{sistema}.md
- Willians aprova explicitamente

### regressao-de-stable
- se comportamento estabilizado regredir → artefato nao retorna para stable automaticamente
- deve passar por approved → validating → approved → stable novamente

### quem-pode-propor-mudanca
- qualquer agente ou ia pode propor
- Willians aprova

---

## deprecated

### significado-operacional
nao recomendado para uso. mantido apenas por referencia historica ou compatibilidade.

### nivel-de-confiabilidade
nao confiavel para uso ativo. apenas para referencia de historico.

### comportamento-esperado
- nao deve ser consumido por ias como contexto ativo
- pode ser referenciado para entender historico de decisao
- nao recebe manutencao ativa

### requisitos-para-deprecated
- artefato substituto identificado e referenciado
- motivo da deprecacao documentado no proprio artefato
- sistemas que dependiam do artefato notificados

### quem-pode-deprecar
- Willians

---

## archived

### significado-operacional
congelado. sem manutencao. sem uso ativo. historico preservado.

### nivel-de-confiabilidade
zero para uso operacional. apenas referencia historica.

### comportamento-esperado
- nao aparece em bootstrap de contexto de ias
- nao recebe leitura ativa em sessoes operacionais
- existe apenas como registro historico

### quando-usar
- artefato deprecated que ja nao tem valor de referencia ativa
- experimentos encerrados

### quem-pode-arquivar
- Willians

---

# fluxo-oficial-de-promocao

```
draft
  → revisao por Willians
  → validating

validating
  → ciclo de uso real sem regressao
  → Willians valida explicitamente
  → approved

approved
  → multiplos ciclos sem necessidade de alteracao
  → Willians avalia maturidade de invariante
  → stable

stable
  → sistema evolui e artefato fica obsoleto
  → Willians depreca com substituto identificado
  → deprecated

deprecated
  → periodo de referencia historica encerrado
  → Willians arquiva
  → archived
```

---

# fluxo-de-regressao-de-status

regressao acontece quando o comportamento definido pelo artefato falha em uso real.

```
stable → approved
  quando: comportamento estabilizado regride em uso real
  acao: registrar regressao em registro-de-decisoes-{sistema}.md, revisar artefato

approved → validating
  quando: problema ativo encontrado relacionado ao artefato
  acao: registrar problema, iniciar novo ciclo de validacao

validating → draft
  quando: conteudo se mostrou inconsistente com o sistema
  acao: rever estrutura antes de qualquer uso

qualquer status → deprecated
  quando: artefato foi substituido por versao mais adequada
  acao: referenciar substituto, documentar motivo
```

regressao nao e falha — e sinal de que o sistema esta funcionando corretamente.

---

# regras-por-categoria-de-artefato

## outputs-de-ia

| regra | descricao |
|---|---|
| status inicial obrigatorio | draft |
| promocao automatica | proibida — exige revisao de Willians |
| pode ser contexto oficial | apenas apos promocao para validating ou superior |
| pode ser consumido por ia como verdade | apenas se status approved ou superior |

## contratos-operacionais

| regra | descricao |
|---|---|
| status minimo para uso operacional | validating |
| status minimo para ser referenciado como invariante | approved |
| mudanca sem justificativa | proibida em approved ou superior |
| requer historico em registro-de-decisoes | sim, a partir de approved |
| regressao de comportamento | deve bloquear uso ate resolucao |

## documentos-de-governanca

| regra | descricao |
|---|---|
| destino | `00-governance/` |
| status inicial recomendado | validating ou approved conforme maturidade |
| mudanca | documentada com motivo e impacto |
| pode ser bypassado | nunca |

---

# regra-anti-acumulacao

todo artefato em draft ou experimental deve ter:
- data de criacao registrada no metadata
- revisao em no maximo 30 dias ou ser arquivado

artefatos em validating sem movimento por mais de 60 dias devem ser:
- promovidos para approved se comportamento e consistente
- regredidos para draft se conteudo perdeu relevancia
- arquivados se nao ha uso ativo

---

# historico-de-versao

| versao | data | descricao |
|---|---|---|
| v1.0 | 2026-05-24 | criacao inicial para kernel-hq |
