import express from "express";
import WebSocket, { Server as WebSocketServer } from "ws";
import http from "http";
import { urlencoded } from "body-parser";
import dotenv from "dotenv";
import { ChatHandler } from "../src/handlers/handle_llm";
import { AIMessage } from "@langchain/core/messages";
import { SpeechClient } from "@google-cloud/speech";
import {
  WELCOME_MESSAGE,
} from "./utils/constant";
const app = express();
dotenv.config();
const server = http.createServer(app);
const PORT = process.env.AI_SPAM_BLOCKER_BE_PORT;
const speechClient = new SpeechClient();
const chatHandler = new ChatHandler();
const isStreaming = false;
let INTERRUPT_SPEAKING = false;
let last_call_executed = Date.now();
let silenceThreshold = 1000;
let lastTranscript = "";
let recognizeStream: any = null;
let transscriptBuffer: String[] = [];
let toSendAudio: Buffer | String | null | any = null;
let toSendAudioStream: any = null;
const wss = new WebSocketServer({ server });
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  "inbound-setup-425607-f7-4570e0d204b4.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/\\n/g, "\n");

const requestConfig: any = {
  config: {
    encoding: "MULAW",
    languageCode: "en-IN",
    sampleRateHertz: 8000,
  },
  interimResults: true,
};

/**
 * Set the audio response to send.
 * @param {any} response - The audio response to send.
 */
function setAudioResponse(response: any) {
  if (isStreaming) {
    toSendAudioStream = response;
  } else {
    toSendAudio = response;
  }
}

/**
 * Sends a welcome message audio response.
 * This function generates an audio stream or audio content based on the streaming flag.
 * Utilizes Deepgram API for streaming and Google Text-to-Speech for non-streaming.
 */
async function sendWelcomeMessage() {
  try {
    if (isStreaming) {
      toSendAudioStream = await chatHandler.createAudioStreamDeepgram(WELCOME_MESSAGE);
    } else {
      toSendAudio = await chatHandler.createAudioContent(WELCOME_MESSAGE);
    }
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
}

/**
 * Processes an audio chunk by writing it to the recognition stream.
 *
 * @param {Buffer} chunk - The audio chunk to be processed.
 */
function processAudioChunk(chunk: Buffer) {
  if (recognizeStream) {
    recognizeStream.write(chunk);
  }
}


async function runSilenceDetector() {
  let pre_fetch_status = 0;
  let lastCalledFactor = 0;
  let preFetchedResponse: Promise<{
    response: ReadableStream<Uint8Array> | null;
    toolResult: any;
  } | null> = new Promise((res, rej) => {
    res(null);
  });
  while (true) {
    if (Date.now() - last_call_executed > silenceThreshold) {
      if (lastTranscript != "") {
        transscriptBuffer.push(lastTranscript);
        console.log("SILENCE DETECTED");
        let _response, _toolResult;

        const _preFetchedResponse = await preFetchedResponse;
        if (_preFetchedResponse) {
          if (_preFetchedResponse && !_toolResult) {
            _response = _preFetchedResponse.response;
            _toolResult = _preFetchedResponse.toolResult;
          }
        } else {
          const { response, toolResult } = await chatHandler.handleChat(
            lastTranscript,
            isStreaming
          );
          _response = response;
          _toolResult = toolResult;
        }
        setAudioResponse(_response);
        if (_toolResult) {
          let tool_response = (await _toolResult)?.output;
          chatHandler.addToChatHistory(new AIMessage(tool_response));
          let { response: res } = await chatHandler.handleToolResult(
            tool_response,
            isStreaming
          );
          setAudioResponse(res);
        }
      }
      lastTranscript = "";
      pre_fetch_status = 0;
      lastCalledFactor = 0;
      resetTranscriptionBuffer();
    } else {
      console.log({ pre_fetch_status });
      let words_count = lastTranscript.split(" ").length ?? 0;
      console.log(words_count, "words_count");
      if (words_count >= 6 && pre_fetch_status == 0) {
        pre_fetch_status = 1;
        preFetchedResponse = chatHandler.handleChat(
          lastTranscript,
          isStreaming
        );
      }

      if (words_count >= 8 && pre_fetch_status >= 1) {
        let factor = Math.floor(words_count / 4);
        if (factor > lastCalledFactor) {
          preFetchedResponse = chatHandler.handleChat(
            lastTranscript,
            isStreaming
          );
          lastCalledFactor = factor;
          pre_fetch_status = 2;
        }
      }
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
}

function resetTranscriptionBuffer() {
  lastTranscript = ''
  if (recognizeStream) {
    recognizeStream.destroy();
    recognizeStream = null;
    recognizeStream = speechClient
      .streamingRecognize(requestConfig)
      .on("data", (data: any) => {
        let transcript = data.results[0].alternatives[0].transcript;
        processRealtimeTranscript(transcript);
        console.log("Transcript: ", transcript);
      })
      .on("error", (e: Error) => {
        console.error("Error in streamingRecognize:", e);
        recognizeStream = null;
      })
      .on("end", () => {
        recognizeStream = null;
      });
  }
}

async function processRealtimeTranscript(transcript: string) {
  if (transcript != "") {
    if (transcript.split(" ").length) {
      INTERRUPT_SPEAKING = true;
    }
    lastTranscript = transcript;
    last_call_executed = Date.now();
  }
}

app.use(urlencoded({ extended: false }));

wss.on("connection", (ws: WebSocket) => {
  if (!recognizeStream) {
    recognizeStream = speechClient
      .streamingRecognize(requestConfig)
      .on("data", (data: any) => {
        let transcript = data.results[0].alternatives[0].transcript;
        processRealtimeTranscript(transcript);
        console.log("Transcript: ", transcript);
      })
      .on("error", (e: Error) => {
        console.error("Error in streamingRecognize:", e);
        recognizeStream = null;
      })
      .on("end", () => {
        recognizeStream = null;
      });
  }
  ws.on("message", async (message: WebSocket.Data) => {
    const msg = JSON.parse(message.toString());
    switch (msg.event) {
      case "connected":
        break;
      case "start":
        console.log("Starting media stream");
        sendWelcomeMessage();
        break;
      case "clear":
        console.log("Cleared media marked");
        break;
      case "media":
        processAudioChunk(Buffer.from(msg.media.payload, "base64"));
        if (toSendAudio) {
          resetTranscriptionBuffer()
          ws.send(
            JSON.stringify({
              event: "media",
              streamSid: msg.streamSid,
              media: {
                payload: toSendAudio.toString("base64"),
              },
            })
          );
          toSendAudio = null;
        }

        if (toSendAudioStream) {
          resetTranscriptionBuffer()
          while (true) {
            try {
              const { done, value: chunk } = toSendAudioStream
                ? await toSendAudioStream.read()
                : { done: true, value: null };
              if (done) break;
              ws.send(
                JSON.stringify({
                  event: "media",
                  streamSid: msg.streamSid,
                  media: {
                    payload: Buffer.from(chunk).toString("base64"),
                  },
                })
              );
            } catch (error) {
              toSendAudioStream = null;
            }
          }
          INTERRUPT_SPEAKING = false;
          toSendAudioStream = null;
        }

        if (INTERRUPT_SPEAKING) {
          ws.send(
            JSON.stringify({
              event: "clear",
              streamSid: msg.streamSid,
            })
          );
          INTERRUPT_SPEAKING = false;
        }
        break;
      case "stop":
        console.log("Call has ended");
        if (recognizeStream) {
          recognizeStream.destroy();
          recognizeStream = null;
        }
        break;
      default:
        break;
    }
  });
});

app.post("/", (request, response) => {
  response.type("text/xml");
  console.log('-0------------------')
  const responseString = `
  <Response>
    <Connect>
      <Stream url="wss://${request.headers.host}"/>
    </Connect>
  </Response>
  `;
  response.send(responseString);
  runSilenceDetector();
});

server.listen(PORT, () => {
  console.log("App is running on PORT: ", PORT);
});