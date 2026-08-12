FROM node:22-alpine

WORKDIR /app

COPY package.json bun.lock ./

RUN npm install -g bun

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

EXPOSE 5015

CMD ["bun", "run", "start", "--", "-p", "5015"]