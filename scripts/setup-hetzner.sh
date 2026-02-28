#!/bin/bash
# SoundGraph - Hetzner VPS Setup Script
# Run this on a fresh Ubuntu 24.04 server as root
# Usage: ssh root@YOUR_SERVER_IP 'bash -s' < scripts/setup-hetzner.sh

set -euo pipefail

echo "=== SoundGraph Hetzner Setup ==="

# 1. Update system
echo "→ Updating system packages..."
apt-get update -y && apt-get upgrade -y

# 2. Install PostgreSQL 16
echo "→ Installing PostgreSQL 16..."
apt-get install -y postgresql-16 postgresql-client-16 wget xz-utils

# 3. Configure PostgreSQL for remote access
echo "→ Configuring PostgreSQL..."
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"

# Listen on all interfaces
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"

# Performance tuning for 2GB RAM server
cat >> "$PG_CONF" <<'PGCONF'

# SoundGraph performance tuning (2GB RAM)
shared_buffers = 512MB
effective_cache_size = 1GB
maintenance_work_mem = 128MB
work_mem = 8MB
max_connections = 50
random_page_cost = 1.1
effective_io_concurrency = 200
PGCONF

# Allow password connections from anywhere (we'll use SSL + strong password)
echo "host all soundgraph 0.0.0.0/0 scram-sha-256" >> "$PG_HBA"

# 4. Create database and user
echo "→ Creating database and user..."
SOUNDGRAPH_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
sudo -u postgres psql <<SQL
CREATE USER soundgraph WITH PASSWORD '${SOUNDGRAPH_PASSWORD}';
CREATE DATABASE soundgraph OWNER soundgraph;
GRANT ALL PRIVILEGES ON DATABASE soundgraph TO soundgraph;
\c soundgraph
GRANT ALL ON SCHEMA public TO soundgraph;
SQL

# 5. Restart PostgreSQL
echo "→ Restarting PostgreSQL..."
systemctl restart postgresql
systemctl enable postgresql

# 6. Configure firewall
echo "→ Configuring firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 5432/tcp  # PostgreSQL
ufw --force enable

# 7. Output connection info
echo ""
echo "=========================================="
echo "  SoundGraph PostgreSQL Setup Complete!"
echo "=========================================="
echo ""
echo "Connection details:"
echo "  Host: $(curl -4 -s ifconfig.me)"
echo "  Port: 5432"
echo "  Database: soundgraph"
echo "  User: soundgraph"
echo "  Password: ${SOUNDGRAPH_PASSWORD}"
echo ""
echo "DATABASE_URL:"
echo "  postgresql://soundgraph:${SOUNDGRAPH_PASSWORD}@$(curl -4 -s ifconfig.me):5432/soundgraph"
echo ""
echo "Save this password! It won't be shown again."
echo "=========================================="
