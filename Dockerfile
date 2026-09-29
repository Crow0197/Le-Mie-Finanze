# --- Stage 1: build dell'app Angular ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: server statico ---
FROM nginx:alpine
COPY --from=build /app/dist/le-mie-finanze/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80