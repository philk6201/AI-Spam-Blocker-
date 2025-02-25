import { ChatOpenAI } from "@langchain/openai";
import { GoogleCalendarAgentParams, GoogleCalendarCreateTool, GoogleCalendarViewTool } from "@langchain/community/tools/google_calendar";
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { initializeAgentExecutorWithOptions } from "langchain/agents";
const jsonData = require('./../../inbound-setup-425607-f7-4570e0d204b4.json');
import { googleTransciber, openAITransciber } from "../utils/helpers";
import { createClient } from "@deepgram/sdk";
import dotenv from "dotenv";
import { DEEPGRAM_API_KEY, SYSTEM_PROMPT } from "../utils/constant";
import { sendEmailNotification } from "../utils/sendEmail";

dotenv.config();

class ChatHandler {
  private apiKey = process.env.AI_SPAM_BLOCKER_OPEN_AI_KEY;
  private model: ChatOpenAI;
  private googleCalendarParams: GoogleCalendarAgentParams;
  private tools: any[];
  private chatHistory: (HumanMessage | SystemMessage)[] = [];

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: 'gpt-3.5-turbo'
    });

    this.googleCalendarParams = {
      credentials: {
        clientEmail: jsonData.client_email,
        privateKey: jsonData.private_key,
        calendarId: process.env.GOOGLE_CALENDAR_ID,
      },
      scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      model: this.model as any,
    };

    this.tools = [
      new GoogleCalendarCreateTool(this.googleCalendarParams),
      new GoogleCalendarViewTool(this.googleCalendarParams),
    ];
  }

  async handleChat(message: string, stream:boolean = true): Promise<{ response: ReadableStream<Uint8Array> | null, toolResult: any | null}> {
    try {
      console.time('handleChat');
      const { content, toolResult } = await this.getLlmTextResponse(message);
      console.timeEnd('handleChat');
      console.time('createAudioStreamFromText');
      let audioResponse 
      if (stream) {
        audioResponse = await this.createAudioStreamDeepgram(content);
      } else {
        audioResponse = await this.createAudioContent(content)
      }
      console.timeEnd('createAudioStreamFromText');
      return { response: audioResponse, toolResult };
    } catch (error) {
      console.error("Error during handleChat: ", error);
      throw error;
    }
  }

  async handleToolResult(message: string, stream:boolean = true): Promise<{ response: ReadableStream<Uint8Array> | null, toolResult: any | null }> {
    try {
      const { content, toolResult } = await this.getLlmToolResponse(message);
      console.timeEnd('handleChat');
      console.time('createAudioStreamFromText');
      let audioResponse 
      if (stream) {
        audioResponse = await this.createAudioStreamDeepgram(content);
      } else {
        audioResponse = await this.createAudioContent(content)
      }
      console.timeEnd('createAudioStreamFromText');
      return { response: audioResponse, toolResult };
    } catch (error) {
      console.error("Error during handleChat: ", error);
      throw error;
    }
  }

  private async getLlmTextResponse(message: string): Promise<{ content: string, toolResult: any | null }> {
    try {
      const res = await this.model.invoke([
        new SystemMessage({ content: SYSTEM_PROMPT }),
        ...this.chatHistory,
        new HumanMessage({ content: message })
      ], {
        // tools: this.tools,
        // tool_choice: 'auto'
      });

      if (res.additional_kwargs?.tool_calls?.length) {
        const toolName = res.additional_kwargs?.tool_calls[0].function.name;
        const inputArgs = JSON.parse(res.additional_kwargs.tool_calls[0].function.arguments);
        const calendarAgent = await this.getCalendarAgent();
        const toolResult = calendarAgent.invoke({
          input: inputArgs.input + ' and include all the kwargs details in your Final answer'
        });
        if (toolName.includes('google_calendar_create')) {
          await sendEmailNotification();
        }
        return {
          content: "Please hold on for a moment while I check the records. Your patience is appreciated; this may take a few seconds.",
          toolResult
        };
      }

      this.chatHistory.push(
        new HumanMessage({ content: message }),
        res
      );

      return {
        content: res.content as string,
        toolResult: null
      };
    } catch (error) {
      console.error("Error during getLlmTextResponse: ", error);
      throw error;
    }
  }

  private async getLlmToolResponse(message: string): Promise<{ content: string, toolResult: any | null }> {
    try {
      const res = await this.model.invoke([
        new SystemMessage(`Give a very brief conversational response for the user from details received from the tool execution result. Do not include meeting link. The tool result is:
          ${message}
          `)
      ]);

      return {
        content: res.content as string,
        toolResult: null
      };
    } catch (error) {
      console.error("Error during getLlmToolResponse: ", error);
      throw error;
    }
  }

  async createCalendarEvent(input: string): Promise<any> {
    const calendarAgent = await this.getCalendarAgent();
    const createResult = await calendarAgent.invoke({ input });
    return createResult;
  }

  async getCalendarAgent(): Promise<any> {
    const calendarAgent = await initializeAgentExecutorWithOptions(this.tools, this.model, {
      agentType: "zero-shot-react-description",
      verbose: false,
    });
    return calendarAgent;
  }

  async createAudioStreamDeepgram(text: string): Promise<ReadableStream<any>> {
    const deepgram = createClient(DEEPGRAM_API_KEY);

    try {
      const response = await deepgram.speak.request(
        { text },
        {
          model: "aura-asteria-en",
          encoding: 'mulaw',
          container: "wav",
        }
      );

      const stream = await response.getStream();
      const headers = await response.getHeaders();
      const reader = stream?.getReader();
      return reader as any;
    } catch (error) {
      console.error("Deepgram API Error:", error);
      throw error;
    }
  }

  async createAudioContent(text:string): Promise<any> {
    return await googleTransciber(text)
  }

  addToChatHistory(message: HumanMessage | SystemMessage): void {
    this.chatHistory.push(message);
  }
}

export {
  ChatHandler
};

