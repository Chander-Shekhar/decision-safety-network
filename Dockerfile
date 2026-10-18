# API image for Cloud Run. Config and secrets come from the Cloud Run service at deploy time, never from the image.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api ./apps/api
RUN npm ci --workspace apps/api --include-workspace-root
RUN npm --workspace apps/api run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev --workspace apps/api && npm cache clean --force
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 8080
USER node
CMD ["node", "apps/api/dist/apps/api/src/server.js"]
