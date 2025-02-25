import fs from "fs";
import { WaveFile } from "wavefile";
import textToSpeech from "@google-cloud/text-to-speech";
import OpenAI from "openai";
import util from "util";
import dotenv from "dotenv";
import { protos } from "@google-cloud/speech";
const WavDecoder = require("wav-decoder");
dotenv.config();
const apiKey = process.env.AI_SPAM_BLOCKER_OPEN_AI_KEY;
const readFile = util.promisify(fs.readFile);
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: "inbound-setup-425607-f7-4570e0d204b4.json",
});

async function convertWavToMuLawBuffer(filePath: Buffer): Promise<string> {
  const wav = new WaveFile(filePath);
  wav.toSampleRate(8000);
  wav.toMuLaw();

  if ("samples" in wav?.data) {
    const payload = Buffer.from(wav?.data?.samples as any);
    return payload.toString("base64");
  }
  return "";
}

async function openAITransciber(
  text: string,
  pathToSave: string = "output.wav"
): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const audioResponse = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    response_format: "wav",
    speed: 1,
  });

  const audioBuffer = await audioResponse.arrayBuffer();
  const audioData = await WavDecoder.decode(audioBuffer);

  const duration = audioData.channelData[0].length / audioData.sampleRate;
  console.log("Audio duration:", duration, "seconds");

  const audioBufferMulaw = await convertWavToMuLawBuffer(
    Buffer.from(audioBuffer)
  );
  return audioBufferMulaw;
}

async function googleTransciber(text: string): Promise<any> {
  // console.log('googleTransCriber');
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { name:'hi-IN-Wavenet-D', languageCode: "hi-IN", ssmlGender: "FEMALE" },
    audioConfig: { audioEncoding: "MULAW", sampleRateHertz: 8000, speakingRate:1.2 },
  });

  // The response's audioContent is binary.
  const writeFile = util.promisify(fs.writeFile);
  console.log(writeFile,'writeFile');
  if (response?.audioContent) {
    await writeFile("output.wav", response.audioContent, "binary");
  }

  // Return the audio stream
  return response.audioContent;
}

async function localTranscriber(path: string): Promise<string> {
  const wavBuffer = await readFile(path);
  const audioData = await WavDecoder.decode(wavBuffer);

  const duration = audioData.channelData[0].length / audioData.sampleRate;
  console.log("Audio duration:", duration, "seconds");

  const audioBufferMulaw = await convertWavToMuLawBuffer(
    Buffer.from(wavBuffer)
  );
  return audioBufferMulaw;
}

async function saveAudioFile(
  audioBuffer: string | ArrayBuffer,
  pathToSave: string
): Promise<void> {
  if (typeof audioBuffer === "string") {
    const buffer = Buffer.from(audioBuffer, "base64");
    fs.writeFile(pathToSave, buffer, (err) => {
      if (err) {
        console.error("Error saving the audio file:", err);
      } else {
        console.log("Audio file saved successfully as", pathToSave);
      }
    });
  } else if (audioBuffer instanceof ArrayBuffer) {
    const buffer = Buffer.from(new Uint8Array(audioBuffer));
    fs.writeFile(pathToSave, buffer, (err) => {
      if (err) {
        console.error("Error saving the audio file:", err);
      } else {
        console.log("Audio file saved successfully as", pathToSave);
      }
    });
  } else {
    console.error("Unexpected audio data format:", typeof audioBuffer);
  }
}

export {
  convertWavToMuLawBuffer,
  openAITransciber,
  googleTransciber,
  localTranscriber,
  saveAudioFile,
};
