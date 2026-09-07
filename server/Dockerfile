# Ce Dockerfile part du contenu du dossier server/ (build context = server/)
FROM node:22-alpine

WORKDIR /app

# git est nécessaire : certaines dépendances (ex: Baileys) résolvent des
# sous-dépendances via des URLs git pendant npm install. Alpine ne l'a pas
# par défaut. openssl est requis par le moteur Prisma (sinon crash au démarrage).
RUN apk add --no-cache git openssl

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000

# Démarre l'API tout de suite (le port doit répondre sans attendre la DB),
# pendant qu'en parallèle on attend MySQL, applique le schéma, puis seed.
CMD ["sh", "-c", "node src/index.js & for i in 1 2 3 4 5 6 7 8 9 10 11 12; do npx prisma db push --accept-data-loss --skip-generate && break; echo 'DB pas prete, nouvelle tentative dans 5s...'; sleep 5; done; node prisma/seed.js || true; wait"]
