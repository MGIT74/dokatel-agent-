# Ce Dockerfile part du contenu du dossier server/ (build context = server/)
FROM node:22-alpine

WORKDIR /app

# git est nécessaire : certaines dépendances (ex: Baileys) résolvent des
# sous-dépendances via des URLs git pendant npm install. Alpine ne l'a pas
# par défaut.
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000

# Attend que MySQL soit prêt (premier démarrage du conteneur db = quelques
# secondes d'initialisation), réessaie db push jusqu'à 10 fois, puis seed, puis démarre.
CMD ["sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10; do npx prisma db push --accept-data-loss --skip-generate && break; echo 'DB pas prete, nouvelle tentative dans 5s...'; sleep 5; done; node prisma/seed.js; node src/index.js"]
