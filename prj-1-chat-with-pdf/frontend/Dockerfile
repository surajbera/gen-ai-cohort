FROM node:20-alpine

WORKDIR /app

# Install deps at build time so the image is self-contained / runnable on its own.
COPY package.json ./
RUN npm install

# Source is bind-mounted in docker-compose for hot reload.
COPY . .

EXPOSE 5173

# Auto-heal on dep changes: when the anonymous /app/node_modules volume is
# out of sync with the image's node_modules (e.g. after package.json changes),
# `npm install` here brings it back in line. With cached deps it's a few seconds;
# with fresh deps it pulls in only what's missing.
CMD ["sh", "-c", "npm install --prefer-offline --no-audit --silent && npm run dev -- --host 0.0.0.0"]
