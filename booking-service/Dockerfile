FROM node:22-bookworm-slim AS landing
WORKDIR /build
COPY ["King's Cafe Landing Pages/escape-the-usual-breakfast/source/package.json", "King's Cafe Landing Pages/escape-the-usual-breakfast/source/package-lock.json", "./"]
RUN npm ci --no-audit --no-fund
COPY ["King's Cafe Landing Pages/escape-the-usual-breakfast/source/", "./"]
ENV VITE_RESERVATION_ENDPOINT=/api/bookings
RUN npx vite build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node booking-service/package.json booking-service/server.mjs booking-service/store.mjs ./
COPY --chown=node:node booking-service/public ./public
COPY --from=landing --chown=node:node /build/dist ./landing
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4174 DATABASE_PATH=/data/bookings.sqlite
EXPOSE 4174
VOLUME /data
CMD ["node", "server.mjs"]
