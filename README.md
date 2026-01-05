# Traffic Core – Blockchain Hyperledger Fabric v3.1.3 (SmartBFT)

## 1. Objectif du projet

Ce projet implémente la partie **Blockchain du Traffic Core** sur **Hyperledger Fabric v3.1.3**.
Il permet de gérer les entités de la simulation (véhicules, routes, intersections) via des
**transactions blockchain**, avec un réseau configuré en **consensus SmartBFT**.

Ce dépôt contient uniquement :
- le **code applicatif et chaincode**,
- les **fichiers de configuration SmartBFT**,
- les **scripts nécessaires** pour démarrer le réseau.

Aucun artefact généré (certificats, blocs, logs) n’est versionné.

---

## 2. Structure du dépôt

```
.
├── test-network/      # Réseau Fabric configuré manuellement pour SmartBFT (v3.1.3)
├── traffic-core/      # Chaincode + application backend / frontend
└── README.md
```

Les dossiers générés automatiquement (`organizations/`, `channel-artifacts/`, etc.)
sont créés localement lors de l’exécution.

---

## 3. Prérequis

- Linux ou Windows + WSL (Ubuntu recommandé)
- Docker & Docker Compose
- Node.js (v18 recommandé)
- Git
- Hyperledger Fabric **v3.1.3**

---

## 4. Installation d’Hyperledger Fabric v3.1.3

Installer les binaires Fabric (version 3.1.3) et les images Docker :

```bash
mkdir -p ~/fabric && cd ~/fabric
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 3.1.3
```

Vérification :
```bash
peer version
```

---

## 5. Initialisation du réseau SmartBFT (sans network.sh up)

Le réseau est démarré **manuellement** à partir des fichiers et scripts présents
dans le dossier `test-network`.

### Étapes générales suivies :

1. Génération des certificats (Fabric CA ou crypto config fournie)
2. Génération du bloc genesis SmartBFT (configtx)
3. Démarrage des orderers SmartBFT (docker-compose)
4. Démarrage des peers
5. Création du channel

Les commandes exactes sont celles fournies dans :
```
test-network/
```
et utilisées telles quelles dans le cadre de ce projet.

---

## 6. Déploiement du chaincode Traffic Core

Le chaincode se trouve dans :
```
traffic-core/chaincode-javascript
```

Le déploiement est effectué **manuellement** (cycle de vie Fabric v3) :
- packaging
- installation sur les peers
- approbation par les organisations
- commit sur le channel

Les commandes utilisées correspondent à la procédure standard Fabric v3.1.3.

---

## 7. Lancement de l’application backend

Se placer dans le backend :

```bash
cd traffic-core/application
npm install
node server.js
```

Le backend démarre sur :
```
http://localhost:3000
```

---

## 8. Fonctionnalités blockchain implémentées

- Création et lecture des véhicules (assets)
- Mise à jour du statut des véhicules via transactions
- Enregistrement immuable sur le ledger
- Validation multi-organisations
- Consensus **SmartBFT**
- Intégration avec la simulation Traffic Core

---

## 9. Arrêt du réseau

L’arrêt du réseau est effectué via les fichiers `docker-compose` fournis
dans `test-network` :

```bash
docker compose down -v
```
