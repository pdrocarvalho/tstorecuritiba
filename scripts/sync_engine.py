import pandas as pd
from sqlalchemy import create_engine, text
from datetime import date

# Configuração da base de dados
db_url = 'sqlite:///tstore_curitiba.db'
engine = create_engine(db_url)

def sync_excel_with_db(file_path):
    df_excel = pd.read_excel(file_path)

    # Mapeamento de colunas
    col_ref = 'REF.'
    col_volumes = 'VOLUMES'
    col_descricao = 'DESCRIÇÃO'
    col_previsao = 'PREVISÃO\nDE ENTREGA'
    col_entrega = 'DATA DE\nENTREGA'

    # Limpeza
    df_excel[col_ref] = df_excel[col_ref].astype(str)
    df_excel[col_volumes] = pd.to_numeric(df_excel[col_volumes], errors='coerce').fillna(0).astype(int)

    stats = {
        'novos_pedidos': 0,
        'novas_previsoes': 0,
        'chegadas': 0
    }

    with engine.connect() as conn:
        for _, row in df_excel.iterrows():
            sku = row[col_ref]
            volumes = row[col_volumes]
            descricao = row[col_descricao]
            previsao = pd.to_datetime(row[col_previsao]).date() if pd.notna(row[col_previsao]) else None
            entrega = pd.to_datetime(row[col_entrega]).date() if pd.notna(row[col_entrega]) else None

            # 1. Garantir que o produto existe
            conn.execute(text("INSERT OR IGNORE INTO produtos (sku, descricao) VALUES (:sku, :descricao)"),
                         {'sku': sku, 'descricao': descricao})

            # 2. Verificar se o pedido já existe (baseado em SKU e Quantidade para simplificar, idealmente teria um ID de pedido único no Excel)
            # Para este projeto, vamos assumir que SKU + Volumes identifica um registro de rastreio único se não houver ID
            query = text("SELECT id, order_status, previsao_entrega, data_entrega FROM pedidos_rastreio WHERE produto_sku = :sku AND quantidade = :volumes")
            result = conn.execute(query, {'sku': sku, 'volumes': volumes}).fetchone()

            if not result:
                # Novo Registro
                order_status = 'Chegou' if entrega else ('Previsto' if previsao else 'Faturado')
                notification_status = f'PENDING_{order_status.upper()}'

                conn.execute(text("""
                    INSERT INTO pedidos_rastreio (produto_sku, quantidade, previsao_entrega, data_entrega, order_status, notification_sent_status, consultor_id, cliente_id)
                    VALUES (:sku, :volumes, :previsao, :entrega, :status, :notif_status, 1, 1)
                """), {
                    'sku': sku, 'volumes': volumes, 'previsao': previsao, 'entrega': entrega,
                    'status': order_status, 'notif_status': notification_status
                })
                stats['novos_pedidos'] += 1
            else:
                pedido_id, old_status, old_previsao, old_entrega = result

                # 3. Lógica de Atualização (Regra de Ouro)
                new_status = old_status
                new_notif_status = None

                # Se antes não tinha entrega e agora tem
                if not old_entrega and entrega:
                    new_status = 'Chegou'
                    new_notif_status = 'PENDING_CHEGOU'
                    stats['chegadas'] += 1
                # Se antes não tinha previsão e agora tem (e ainda não tem entrega)
                elif not old_previsao and previsao and not entrega:
                    new_status = 'Previsto'
                    new_notif_status = 'PENDING_PREVISAO'
                    stats['novas_previsoes'] += 1

                if new_notif_status:
                    conn.execute(text("""
                        UPDATE pedidos_rastreio
                        SET previsao_entrega = :previsao, data_entrega = :entrega, order_status = :status, notification_sent_status = :notif_status
                        WHERE id = :id
                    """), {
                        'previsao': previsao, 'entrega': entrega, 'status': new_status,
                        'notif_status': new_notif_status, 'id': pedido_id
                    })

        conn.commit()

    return stats

if __name__ == '__main__':
    # Simulação de sincronização com o mesmo arquivo (ou um novo arquivo diário)
    excel_path = '/home/ubuntu/projects/t-store-curitiba-99b09b41/BANCO_DE_DADOS-RECEBIMENTO.xlsx'
    resumo = sync_excel_with_db(excel_path)
    print(f"Sincronização concluída: {resumo['novos_pedidos']} novos pedidos, {resumo['novas_previsoes']} novas previsões, {resumo['chegadas']} chegadas.")
