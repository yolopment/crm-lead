#!/bin/bash
set -e

echo "=========================================================="
echo " Starting LeadZam-Clone CRM Setup on Hostinger Ubuntu VPS "
echo "=========================================================="

# 1. Update OS packages
echo "Updating apt repositories..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v20 LTS), PostgreSQL, Nginx, Git, build tools
echo "Installing prerequisites..."
sudo apt install -y curl git build-essential nginx postgresql postgresql-contrib

# Install Node.js 20 LTS if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 globally
sudo npm install -g pm2

# 3. Setup PostgreSQL Database
echo "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE USER crm_user WITH PASSWORD 'crm_secure_password_replace_me';" || true
sudo -u postgres psql -c "CREATE DATABASE crm_lead OWNER crm_user;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crm_lead TO crm_user;" || true

# 4. Create persistent local directory for call audio recordings
echo "Setting up recordings directory..."
sudo mkdir -p /var/crm/recordings
sudo chown -R $USER:$USER /var/crm/recordings
sudo chmod -R 755 /var/crm/recordings

echo "=========================================================="
echo " Hostinger VPS Environment Ready!                          "
echo " Next steps:                                              "
echo " 1. cd server && npm run prisma:push                      "
echo " 2. cd .. && pm2 start deploy/ecosystem.config.js         "
echo " 3. sudo cp deploy/nginx.conf /etc/nginx/sites-available/ "
echo " 4. sudo certbot --nginx -d yourdomain.com                "
echo "=========================================================="

