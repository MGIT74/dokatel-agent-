# Ce Dockerfile part du contenu du dossier server/ (build context = server/)
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000

# Applique les migrations puis démarre l'API à chaque redémarrage du conteneur
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
