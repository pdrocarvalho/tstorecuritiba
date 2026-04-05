import pandas as pd
from sqlalchemy import create_engine, text
from datetime import date
import os.path
import base64
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuração da base de dados
db_url = 'sqlite:///tstore_curitiba.db'
engine = create_engine(db_url)

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# Funções para carregar templates HTML
def load_template(template_name):
    with open(f'/home/ubuntu/{template_name}.html', 'r', encoding='utf-8') as f:
        return f.read()

# Função para gerar a tabela de itens HTML
def generate_items_table(items):
    table_rows = ""
    for item in items:
        table_rows += f"<tr><td>{item['produto_sku']}</td><td>{item['descricao']}</td><td>{item['quantidade']}</td></tr>"
    return f"""
    <table>
        <thead>
            <tr>
                <th>Referência</th>
                <th>Descrição</th>
                <th>Quantidade</th>
            </tr>
        </thead>
        <tbody>
            {table_rows}
        </tbody>
    </table>
    """

def gmail_authenticate():
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return creds

def create_message(sender, to, subject, message_text):
    message = MIMEText(message_text, 'html')
    message['to'] = to
    message['from'] = sender
    message['subject'] = subject
    return {'raw': base64.urlsafe_b64encode(message.as_bytes()).decode()}

def send_email(service, user_id, to_email, subject, body):
    try:
        message = create_message(user_id, to_email, subject, body)
        sent_message = service.users().messages().send(userId=user_id, body=message).execute()
        print(f'Message Id: {sent_message["id"]}')
        return True
    except HttpError as error:
        print(f'An error occurred: {error}')
        return False

# Lógica principal do motor de notificações
def run_notification_engine():
    creds = gmail_authenticate()
    service = build('gmail', 'v1', credentials=creds)
    user_id = 'me'

    with engine.connect() as conn:
        # Obter pedidos pendentes que ainda não foram notificados para o status atual
        query = text("""
            SELECT
                pr.id as pedido_id,
                pr.produto_sku,
                pr.quantidade,
                pr.previsao_entrega,
                pr.data_entrega,
                pr.order_status,
                pr.notification_sent_status,
                c.nome as consultor_nome,
                c.email as consultor_email,
                cl.nome as cliente_nome,
                p.descricao
            FROM pedidos_rastreio pr
            JOIN consultores c ON pr.consultor_id = c.id
            JOIN clientes cl ON pr.cliente_id = cl.id
            JOIN produtos p ON pr.produto_sku = p.sku
            WHERE
                pr.notification_sent_status LIKE 'PENDING_%'
        """)
        pending_orders = pd.read_sql(query, conn)

        if pending_orders.empty:
            print("Nenhum pedido pendente para notificação.")
            return

        # Agrupar por Consultor e Cliente
        grouped_notifications = {}
        for _, row in pending_orders.iterrows():
            key = (row['consultor_id'], row['cliente_nome'], row['order_status'])
            if key not in grouped_notifications:
                grouped_notifications[key] = {
                    'consultor_nome': row['consultor_nome'],
                    'consultor_email': row['consultor_email'],
                    'cliente_nome': row['cliente_nome'],
                    'order_status': row['order_status'],
                    'items': [],
                    'pedido_ids': []
                }
            grouped_notifications[key]['items'].append({
                'produto_sku': row['produto_sku'],
                'descricao': row['descricao'],
                'quantidade': row['quantidade'],
                'previsao_entrega': row['previsao_entrega']
            })
            grouped_notifications[key]['pedido_ids'].append(row['pedido_id'])

        # Processar e enviar notificações
        for key, notification_data in grouped_notifications.items():
            consultor_nome = notification_data['consultor_nome']
            consultor_email = notification_data['consultor_email']
            cliente_nome = notification_data['cliente_nome']
            order_status = notification_data['order_status']
            items = notification_data['items']
            pedido_ids = notification_data['pedido_ids']

            # Gerar tabela de itens HTML
            itens_tabela_html = generate_items_table(items)

            # Selecionar template e montar corpo do e-mail
            subject_prefix = ""
            template_content = ""
            new_notification_status = ""

            if order_status == 'Faturado':
                subject_prefix = "Faturado"
                template_content = load_template('email_template_faturado')
                new_notification_status = 'SENT_FATURADO'
            elif order_status == 'Previsto':
                subject_prefix = "Previsão"
                template_content = load_template('email_template_previsao')
                new_notification_status = 'SENT_PREVISAO'
                # Adicionar previsão de entrega ao template se existir
                previsao_data = items[0]['previsao_entrega'].strftime('%d/%m/%Y') if items[0]['previsao_entrega'] else 'N/A'
                template_content = template_content.replace('{{PREVISAO_ENTREGA}}', previsao_data)
            elif order_status == 'Chegou':
                subject_prefix = "Chegou"
                template_content = load_template('email_template_chegou')
                new_notification_status = 'SENT_CHEGOU'

            # Substituir placeholders no template
            email_body = template_content.replace('{{CONSULTOR_NOME}}', consultor_nome)
            email_body = email_body.replace('{{CLIENTE_NOME}}', cliente_nome)
            email_body = email_body.replace('{{ITENS_TABELA}}', itens_tabela_html)

            # Assunto do e-mail
            email_subject = f"[{subject_prefix}] - CONSULTOR(A): {consultor_nome} - CLIENTE: {cliente_nome}"

            # Enviar e-mail
            if send_email(service, user_id, consultor_email, email_subject, email_body):
                # Atualizar status no banco de dados
                for pedido_id in pedido_ids:
                    update_query = text("""
                        UPDATE pedidos_rastreio
                        SET notification_sent_status = :new_status
                        WHERE id = :pedido_id
                    """)
                    conn.execute(update_query, {'new_status': new_notification_status, 'pedido_id': pedido_id})
                conn.commit()
                print(f"Notificação para {consultor_nome} sobre {cliente_nome} ({order_status}) processada e status atualizado para {new_notification_status}.")
            else:
                print(f"Falha ao enviar notificação para {consultor_nome} sobre {cliente_nome} ({order_status}).")

if __name__ == '__main__':
    run_notification_engine()
