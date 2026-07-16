FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node index.js .
EXPOSE 3000
USER node
# Native container health: node's built-in fetch to the unauthenticated /health
# route (alpine ships no curl/wget-ssl). Root "/" 404s by design, so use /health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
