# syntax=docker/dockerfile:1
ARG BUILDKIT_SBOM_SCAN_CONTEXT=true

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


FROM node-base AS build-base
RUN apt-get update && apt-get install -y zip


FROM build-base AS build
# ARG BUILDKIT_SBOM_SCAN_STAGE=true
ARG BROWSER RELEASE
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    VAULTONOMY_BROWSER=${BROWSER:?} \
    VAULTONOMY_RELEASE=${RELEASE:?} \
    npm run build -- --emptyOutDir --outDir /dist


FROM scratch AS built-files
COPY --from=build /dist/ .


FROM build AS package
ARG BROWSER RELEASE SOURCE_DATE_EPOCH=0
RUN mkdir /packaged \
    && cd /dist \
    && find . -type f -exec \
    touch --no-dereference --date="@${SOURCE_DATE_EPOCH:?}" {} + -print \
    | sort \
    | zip -9 --no-extra -@ "/packaged/vaultonomy-${BROWSER:?}-${RELEASE:?}.zip"


FROM scratch AS packaged-files
COPY --from=package /packaged/* .
