#!/bin/bash

# This script generates SSL certificates using Let's Encrypt

DOMAIN="jazyl.tech"
EMAIL="admin@jazyl.tech"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot
fi

# Generate certificates
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --domains $DOMAIN,*.$DOMAIN \
    --expand

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./nginx/ssl/$DOMAIN.crt
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./nginx/ssl/$DOMAIN.key

# Set proper permissions
chmod 644 ./nginx/ssl/$DOMAIN.crt
chmod 600 ./nginx/ssl/$DOMAIN.key

echo "SSL certificates generated successfully!"