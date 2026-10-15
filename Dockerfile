FROM mcr.microsoft.com/devcontainers/javascript-node:22

# Puerto interno del contenedor (el puerto del host se define en docker-compose.yml)
ARG CONTAINER_PORT=3000
ENV CONTAINER_PORT=${CONTAINER_PORT}

WORKDIR /workspace

# El código se monta como volumen (ver docker-compose.yml), así que
# cualquier cambio en el host se refleja al instante en el contenedor.
EXPOSE ${CONTAINER_PORT}

CMD ["sh", "-c", "npx --yes serve . -l ${CONTAINER_PORT} --no-clipboard"]
