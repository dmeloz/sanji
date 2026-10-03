#!/bin/sh
# Crée une autorité et un certificat locaux pour essayer Sanji en HTTPS sur le réseau de la maison.
# Rien n'est publié : les clés restent dans .certificats-locaux/ (hors Git) et ne servent qu'à ce Mac.
# Usage : sh outils/creer-certificat-local.sh [adresse IP du Mac]   (par défaut : celle de en0)
set -eu
IP="${1:-$(ipconfig getifaddr en0)}"
DIR="$(dirname "$0")/../.certificats-locaux"
mkdir -p "$DIR"
cd "$DIR"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout ca.key -out ca.crt \
  -subj "/CN=Sanji essai local" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -newkey rsa:2048 -nodes -keyout serveur.key -out serveur.csr -subj "/CN=$IP"
printf 'subjectAltName=IP:%s,DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' "$IP" > ext.cnf
openssl x509 -req -in serveur.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -extfile ext.cnf -out serveur.crt
chmod 600 ca.key serveur.key
echo "Certificat créé pour $IP (valable 365 jours) dans .certificats-locaux/"
