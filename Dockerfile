FROM node:18
WORKDIR /app
COPY package.json .
COPY server/package.json ./server/
RUN npm install
COPY . .
# Hugging Face Spaces uses port 7860 by default
ENV PORT=7860
CMD ["node", "server/index.js"]
