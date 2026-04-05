# Mapeamento de Dados — BANCO_DE_DADOS-RECEBIMENTO.xlsx

## Colunas do Excel → Banco de Dados

| Coluna no Excel | Campo no Banco | Tipo | Observação |
|-----------------|---------------|------|------------|
| `REF.` | `produto_sku` | VARCHAR(255) PK | Identificador único do produto |
| `VOLUMES` | `quantidade` | INT | Quantidade física de itens |
| `DESCRICAO` | `descricao` | TEXT | Nome completo do produto |
| `PREVISAO_ENTREGA` | `previsao_entrega` | TIMESTAMP NULL | Data estimada de chegada |
| `DATA_ENTREGA` | `data_entrega` | TIMESTAMP NULL | Data real de entrada na loja |

> **Atenção:** Os nomes das colunas no Excel original contêm quebras de linha
> (`PREVISÃO\nDE ENTREGA`). O parser do sync engine normaliza esses nomes
> antes do mapeamento.

## Lógica das 3 Fases

| Fase | `previsao_entrega` | `data_entrega` | `order_status` | `notification_sent_status` |
|------|--------------------|----------------|----------------|---------------------------|
| Faturado | NULL | NULL | `Faturado` | `PENDING_FATURADO` |
| Previsto | Preenchida | NULL | `Previsto` | `PENDING_PREVISTO` |
| Chegou | Qualquer | Preenchida | `Chegou` | `PENDING_CHEGOU` |

## Distribuição Real dos Dados (952 registros)

| Fase | Quantidade | % |
|------|-----------|---|
| Chegou | 908 | 95,4% |
| Faturado | 39 | 4,1% |
| Previsto | 5 | 0,5% |

## Status de Notificação — Ciclo Completo

```
PENDING_FATURADO  →  SENT_FATURADO
PENDING_PREVISTO  →  SENT_PREVISTO
PENDING_CHEGOU    →  SENT_CHEGOU
```

Pedidos só recebem nova notificação se voltarem a `PENDING_*`
(o que ocorre quando há transição de fase na sincronização).
