const preferredPort = Number(Bun.env.PORT ?? 3000);
const candidatePorts = [...Array.from({ length: 5 }, (_, index) => preferredPort + index), 0];

async function createServer() {
  for (const port of candidatePorts) {
    try {
      const server = Bun.serve({
        port,
        async fetch(request) {
          const url = new URL(request.url);
          const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
          const file = Bun.file(`./public${pathname}`);

          if (!(await file.exists())) {
            return new Response("Not Found", { status: 404 });
          }

          return new Response(file);
        },
      });

      console.log(`Workflow app running at ${server.url}`);
      return server;
    } catch (error) {
      if (port === candidatePorts.at(-1)) {
        throw error;
      }
    }
  }

  throw new Error("Failed to start server.");
}

await createServer();
