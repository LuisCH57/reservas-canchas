// Punto de entrada: arranca el servidor
import { app } from "./app.ts";
import { config } from "./config.ts";

app.listen(config.port, () => {
  console.log(`API escuchando en http://localhost:${config.port}`);
});
