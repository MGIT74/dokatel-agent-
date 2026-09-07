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

# Applique le schéma (pas de migrations committées, donc db push) puis démarre
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node src/index.js"]
