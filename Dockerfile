FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY api ./api
COPY www ./www
ENV HOST=0.0.0.0 PORT=4190 DATA_DIR=/data NODE_ENV=production
EXPOSE 4190
CMD ["node","server.mjs"]
