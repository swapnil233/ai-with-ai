import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { app } from "./app.js";
import { auth } from "./lib/auth.js";

dotenv.config();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.API_PORT || 4000;

// Socket.io authentication middleware
io.use(async (socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;

  if (!cookieHeader) {
    return next(new Error("Authentication required"));
  }

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });

  if (!session) {
    return next(new Error("Invalid session"));
  }

  // Attach session and user to socket for later use
  socket.data.session = session.session;
  socket.data.user = session.user;
  next();
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id} (user: ${socket.data.user?.email})`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

export { app, io };
