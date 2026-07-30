#!/bin/bash
# Cài app chạy như systemd service (tự động cùng máy)
# Chạy: bash install-service.sh

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
USER="$(whoami)"

SERVICE_FILE="/etc/systemd/system/vehicle-manager.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Vehicle Manager - Phương Nam
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(which node) $APP_DIR/src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vehicle-manager
sudo systemctl restart vehicle-manager

echo "✅ Done! Status:"
sudo systemctl status vehicle-manager --no-pager | head -10
echo ""
echo "Commands:"
echo "  sudo systemctl start|stop|restart|status vehicle-manager"
echo "  sudo journalctl -u vehicle-manager -f  (xem log)"