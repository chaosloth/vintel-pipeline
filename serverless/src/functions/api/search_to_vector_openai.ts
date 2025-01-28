// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { OpenAI } from "openai";

type MyContext = {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  OPENAI_API_KEY: string;
  OPENAI_EMBEDDINGS_MODEL: string;
};

type MyEvent = {
  query: string;
};

export const handler: ServerlessFunctionSignature<
  MyContext,
  ServerlessEventObject<MyEvent>
> = async function (
  context: Context<MyContext>,
  event: ServerlessEventObject<MyEvent>,
  callback: ServerlessCallback
) {
  const response = new Twilio.Response();
  // Set the CORS headers to allow Flex to make an error-free HTTP request
  // to this Function
  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.appendHeader("Content-Type", "application/json");

  console.log(">>> INCOMING INGESTION REQUEST >>>");
  console.log(event);

  // Ignore events for recordings that aren't completed
  if (!event.query) {
    console.error("Missing query in request");
    response.setBody({ status: "Missing required params" });
    response.setStatusCode(400);
    return callback(null, response);
  }

  try {
    const openai = new OpenAI({
      apiKey: context.OPENAI_API_KEY,
    });

    let embeddingResp = await openai.embeddings.create({
      input: event.query,
      model: context.OPENAI_EMBEDDINGS_MODEL,
    });

    console.log(`OpenAI Embeddings for query`, embeddingResp);
    response.setBody(embeddingResp.data[0].embedding);

    return callback(null, response);
  } catch (e: any) {
    console.error(`Error ingesting data, see error reason`);
    response.setStatusCode(500);
    console.error(e);
    return callback(null, response);
  }
};
