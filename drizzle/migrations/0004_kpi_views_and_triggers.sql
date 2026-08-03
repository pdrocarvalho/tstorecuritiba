-- ─── 1. VIEW DE KPIS DOS PEDIDOS (CRUZAMENTO EFICIENTE) ──────────────────────────
CREATE OR REPLACE VIEW public.vw_pedidos_kpis AS
SELECT 
    pr.id AS pedido_id,
    pr.sheet_id,
    pr.quantidade,
    pr.qtde_por_caixa,
    pr.previsao_entrega,
    pr.data_entrega,
    pr.order_status,
    pr.volumes_caixas,
    pr.remetente,
    pr.nota_fiscal,
    p.sku AS produto_sku,
    p.descricao AS produto_descricao,
    c.nome AS consultor_nome,
    c.email AS consultor_email,
    cl.nome AS cliente_nome
FROM public.pedidos_rastreio pr
LEFT JOIN public.produtos p ON pr.produto_ref = p.sku
LEFT JOIN public.consultores c ON pr.consultor_id = c.id
LEFT JOIN public.clientes cl ON pr.cliente_id = cl.id;

-- ─── 2. TRIGGER FUNCTION PARA AUDITORIA AUTOMÁTICA DE AVARIAS ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_trg_avarias_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.avaria_historico (avaria_id, autor_nome, tipo, conteudo, created_at)
        VALUES (
            NEW.id,
            COALESCE(NEW.responsavel, 'Sistema'),
            'manual',
            'Avaria registrada no sistema. Quantidade inicial: ' || NEW.quantidade,
            NOW()
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Verifica se o status mudou
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO public.avaria_historico (avaria_id, autor_nome, tipo, conteudo, created_at)
            VALUES (
                NEW.id,
                COALESCE(NEW.responsavel, 'Sistema'),
                'status_change',
                'Status alterado de "' || COALESCE(OLD.status, 'N/A') || '" para "' || COALESCE(NEW.status, 'N/A') || '"',
                NOW()
            );
        END IF;
        
        -- Verifica se a tratativa mudou
        IF (OLD.tratativa IS DISTINCT FROM NEW.tratativa) THEN
            INSERT INTO public.avaria_historico (avaria_id, autor_nome, tipo, conteudo, created_at)
            VALUES (
                NEW.id,
                COALESCE(NEW.responsavel, 'Sistema'),
                'tratativa_change',
                'Tratativa atualizada: "' || COALESCE(NEW.tratativa, 'Sem tratativa') || '"',
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. CRIAÇÃO DO GATILHO NA TABELA DE AVARIAS ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_avarias_audit ON public.avarias;
CREATE TRIGGER trg_avarias_audit
AFTER INSERT OR UPDATE ON public.avarias
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_avarias_audit();
