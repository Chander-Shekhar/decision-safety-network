# API image for the eventual Cloud Run deployment (region asia-south1). Not built or deployed in this pass.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm ci --workspace apps/api --include-workspace-root
RUN npm --workspace apps/api run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# Config comes from the environment at deploy time, never from the image:
# PORT, GOOGLE_CLOUD_PROJECT, GEMINI_MODEL, DSN_SCHEDULER_AUDIENCE, DSN_SCHEDULER_SA.
EXPOSE 8080
USER node
CMD ["node", "apps/api/dist/server.js"]
