CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- users
DROP TRIGGER IF EXISTS trg_users_updated_at ON "users";
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- consultores
DROP TRIGGER IF EXISTS trg_consultores_updated_at ON "consultores";
CREATE TRIGGER trg_consultores_updated_at
BEFORE UPDATE ON "consultores"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- clientes
DROP TRIGGER IF EXISTS trg_clientes_updated_at ON "clientes";
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON "clientes"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- produtos
DROP TRIGGER IF EXISTS trg_produtos_updated_at ON "produtos";
CREATE TRIGGER trg_produtos_updated_at
BEFORE UPDATE ON "produtos"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- pedidos_rastreio
DROP TRIGGER IF EXISTS trg_pedidos_rastreio_updated_at ON "pedidos_rastreio";
CREATE TRIGGER trg_pedidos_rastreio_updated_at
BEFORE UPDATE ON "pedidos_rastreio"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- google_sheets_config
DROP TRIGGER IF EXISTS trg_google_sheets_config_updated_at ON "google_sheets_config";
CREATE TRIGGER trg_google_sheets_config_updated_at
BEFORE UPDATE ON "google_sheets_config"
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();