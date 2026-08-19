# What the Sprite runs. Node 22 slim, app baked in, workspace seeded onto a
# durable volume on first boot so agent-written functions survive restarts.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts
# Baked seed copy of the workspace. The entrypoint copies it onto the mounted
# volume the first time the volume is empty, then leaves the volume alone.
COPY workspace ./workspace-seed

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV PORT=3939
EXPOSE 3939

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
