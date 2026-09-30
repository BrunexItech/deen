FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN adduser -D -u 10001 deen
COPY --from=build --chown=deen /app/.next/standalone ./
COPY --from=build --chown=deen /app/.next/static ./.next/static
COPY --from=build --chown=deen /app/public ./public
USER deen
EXPOSE 3000
CMD ["node", "server.js"]
