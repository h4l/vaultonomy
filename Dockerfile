FROM node:22 AS node-base
WORKDIR /build


FROM node-base AS node-modules
COPY package.json package-lock.json .npmrc .
RUN --mount=type=cache,target=/root/.npm npm ci


FROM node-base AS lint
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run lint


FROM node-base AS prettier
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run prettier


FROM node-base AS typecheck
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run typecheck


FROM node-base AS test
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run test


FROM node-base AS build
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run build
