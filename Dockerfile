# Dataroom OS container. Railway builds this file; it also runs anywhere Docker runs.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Clerk's publishable key is public. Railway passes it in here when it is set in Variables.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Optional: your product name, shown in the app and on viewer pages.
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN npx next build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
# Railway gives the port in PORT. Files and the built-in database go on a volume mounted at /data.
ENV PGLITE_DIR=/data/pglite FILES_DIR=/data/files DATAROOM_SECRET_FILE=/data/secret
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
