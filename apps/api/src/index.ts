import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const server = buildServer();

server.listen({ host: "0.0.0.0", port }).catch((error) => {
  server.log.error(error);
  process.exit(1);
});
