FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb xauth ca-certificates git \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 \
    libxss1 libxkbfile1 libsecret-1-0 libdrm2 libxkbcommon0 libxdamage1 \
    libxcomposite1 libxrandr2 libxfixes3 libcups2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run compile

CMD ["sh", "-c", "npm run test:unit && xvfb-run -a npm run test:integration"]
