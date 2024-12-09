# Utiliser une image Node.js officielle comme image de base
FROM node:18.18.0

# Installer les outils nécessaires (rsync, Xvfb pour Cypress)
# Installer les dépendances nécessaires pour Cypress
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    xvfb \
    rsync

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer toutes les dépendances
RUN npm install 

# Copier le reste du projet
COPY . .

# Copier le fichier .env
COPY .env .env

# Générer la bdd 
RUN npx 

# Compiler le projet
RUN npm run build

# Exposer le port utilisé par Next.js
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
