FROM node:24-alpine AS build
WORKDIR /app
# Sources first: npm ci's postinstall (nuxt prepare) needs the whole project.
COPY . .
RUN npm ci && npm run build

# Nitro's .output is self-contained: it carries the server dependencies it needs.
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/.output .output
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
