#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# One command. Run it ON THE RASPBERRY PI (keyboard + monitor,
# logged in as group12). After that I take over remotely.
# ─────────────────────────────────────────────────────────────
mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
grep -q 'luca@LUCA-LAPTOP' ~/.ssh/authorized_keys 2>/dev/null || \
echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDiPO8P2hNkt301TU8gLaf9rROFV+ifLQrwqj7G+tjz+2mRZjW6sA2F5pvX3quQx4kDEb+VI5ApCxTqDoo/XGiCl8LIAacrbJpdV70Kgd4wTWKJwgEWR99C8hgQUepzXJNrBct4QJXqPjl7SbYTVMi/sKnnOF373U3V/uhJAh9te0XnEdqbf+pGlRC/1zuCFZbEM8jQutOC/MARL9zeco6btfGB8G7JRAqao1tr1QJFYgmKZ9JzyeM/eilf5BhW0CNZHG+tSnxSmPE0Wz5FbhZActzRFho7BK0vm41B0P+a5X7ybITU6YSM6iPg8pKMMCkzEV4eQWgjEBFPSyufxcg55C7E2Fw2YmmWCDMS/UUD2iBqNRTp3kHw9mZxcq2Mlyu3EOlHp/GhjHunD3AA1OaW1xkTGvKRDYbxx9gbksd7KqH/Y0L3hdorHOSjJgDzmsL4k07jr7z/f8Eyr4BtMWDxwUsAXyuyYj/sKKHWwr16jYl27YO2x0HyzmIs25XXvSk= luca@LUCA-LAPTOP' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo
echo "Key installed. Verifying:"
ssh-keygen -lf ~/.ssh/authorized_keys
