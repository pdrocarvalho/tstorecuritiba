-- 1. Cria o usuário/role restrito da aplicação
CREATE USER tstore_app WITH PASSWORD '10362701Drope';

-- 2. Concede permissão de conectar no banco
GRANT CONNECT ON DATABASE postgres TO tstore_app;

-- 3. Concede uso do schema public
GRANT USAGE ON SCHEMA public TO tstore_app;

-- 4. Concede permissões de leitura/escrita em todas as tabelas e views existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tstore_app;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO tstore_app;

-- 5. Garante que futuras tabelas criadas herdem essas mesmas permissões automaticamente
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tstore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO tstore_app;
