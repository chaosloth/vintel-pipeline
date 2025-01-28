// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { Client } from "@elastic/elasticsearch";
import { OpenAI } from "openai";
import { Sentence } from "../../types/Sentences";

type MyContext = {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  VINTEL_SERVICE_SID: string;
  ELASTIC_URI: string;
  ELASTIC_API_KEY: string;
  ELASTIC_CALLS_INDEX: string;
  ELASTIC_TRANSCRIPTION_INDEX: string;
  ELASTIC_SENTENCE_INDEX: string;
  OPENAI_API_KEY: string;
  OPENAI_EMBEDDINGS_MODEL: string;
};

type MyEvent = {
  transcript_sid: any;
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
  if (!event.transcript_sid) {
    console.error("Missing transcript_sid in request");
    response.setBody({ status: "Missing required params" });
    response.setStatusCode(400);
    return callback(null, response);
  }

  try {
    const rsp = await fetch(
      `https://ai.twilio.com/v1/Services/${context.VINTEL_SERVICE_SID}/Transcripts/${event.transcript_sid}/Sentences?PageSize=5000`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(
            context.ACCOUNT_SID + ":" + context.AUTH_TOKEN
          )})`,
        },
      }
    );

    let data = await rsp.json();
    let turns: string[] = [];

    // Create a large array of turns
    (data.sentences as Sentence[]).map((s) => turns.push(s.transcript));

    // Put it in one large string
    let transcript = turns.join(". ");

    const openai = new OpenAI({
      apiKey: context.OPENAI_API_KEY,
    });

    let embeddingResp = await openai.embeddings.create({
      input: transcript,
      model: context.OPENAI_EMBEDDINGS_MODEL,
    });

    console.log(`OpenAI Embeddings for transcript`, embeddingResp);

    delete data.meta;
    data.meta = {
      embedding: embeddingResp.data[0].embedding,
    };

    console.log(`Now inserting into ES`);

    const elasticClient = new Client({
      node: context.ELASTIC_URI,
      auth: { apiKey: context.ELASTIC_API_KEY },
    });

    console.log(`Adding document to index [${context.ELASTIC_SENTENCE_INDEX}]`);

    let elasticResp = await elasticClient.index({
      index: context.ELASTIC_SENTENCE_INDEX,
      document: data,
    });

    response.setBody(elasticResp);
    return callback(null, response);
  } catch (e: any) {
    console.error(`Error ingesting data, see error reason`);
    response.setStatusCode(500);
    console.error(e);
    return callback(null, response);
  }
};
