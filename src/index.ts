import express from "express";
import WebSocket, { Server as WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";

const app = express();  

dotenv.config();
const server = http.createServer(app);
const PORT = process.env.AI_SPAM_BLOCKER_BE_PORT;


app.post("/", (request, response) => {
  response.type("text/xml");
  const responseString = `
  <Response>
    <Connect>
      <Stream url="wss://${request.headers.host}"/>
    </Connect>
  </Response>
  `;
  response.send(responseString);
});

server.listen(PORT, () => {
  console.log("App is running on PORT: ", PORT);
});