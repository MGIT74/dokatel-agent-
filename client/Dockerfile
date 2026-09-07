# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# git est nécessaire pour certaines résolutions de dépendances npm
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install

COPY . .

# Baké au moment du build (Vite inline les variables VITE_* dans le bundle)
ENV VITE_API_URL="https://api.dokatel.com/api"
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
