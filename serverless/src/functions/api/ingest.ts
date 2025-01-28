// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import twilio from "twilio";

import { Client } from "@elastic/elasticsearch";

type MyContext = {
  ACCOUNT_SID: string;
  TWILIO_API_KEY: string;
  TWILIO_API_SECRET: string;
  VINTEL_SERVICE_SID: string;
  ELASTIC_URI: string;
  ELASTIC_API_KEY: string;
  ELASTIC_CALLS_INDEX: string;
  ELASTIC_TRANSCRIPTION_INDEX: string;
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
    // Create the client instead of using context.getTwilioClient() as the TS types are currently
    // pinned to an older version that doesn't contain the Voice Intelligence v1 API types
    const client = twilio(context.TWILIO_API_KEY, context.TWILIO_API_SECRET, {
      accountSid: context.ACCOUNT_SID,
    });

    /******************************************************
     *
     * Fetch the required parts to insert a document
     * 1. Transcript meta data
     * 2. The actual sentences
     * 3. Language operator results (Classification etc)
     *
     ******************************************************/
    console.time(`Fetching transcript: [${event.transcript_sid}]`);
    const transcript = await client.intelligence.v2
      .transcripts(event.transcript_sid)
      .fetch();
    console.timeEnd(`Fetching transcript: [${event.transcript_sid}]`);

    console.time(`Fetching sentences: [${event.transcript_sid}]`);
    const sentences = await client.intelligence.v2
      .transcripts(event.transcript_sid)
      .sentences.list({ wordTimestamps: true });
    console.timeEnd(`Fetching sentences: [${event.transcript_sid}]`);

    console.time(`Fetching operator results: [${event.transcript_sid}]`);
    const operatorResults = await client.intelligence.v2
      .transcripts(event.transcript_sid)
      .operatorResults.list();
    console.timeEnd(`Fetching operator results: [${event.transcript_sid}]`);

    /******************************************************
     *
     * Create a single document with all of fields and meta data
     *
     ******************************************************/
    const transcriptionDoc = {
      ...transcript.toJSON(),
      sentences,
      operatorResults,
    };

    console.log(`Assembled complete doc, now inserting into ES`);

    /******************************************************
     *
     * Connect to Elastic Search
     *
     ******************************************************/
    const elasticClient = new Client({
      node: context.ELASTIC_URI,
      auth: { apiKey: context.ELASTIC_API_KEY },
    });

    console.log(
      `Adding document to index [${context.ELASTIC_TRANSCRIPTION_INDEX}]`
    );

    /******************************************************
     *
     * Insert into Elastic Search
     *
     ******************************************************/
    await elasticClient.index({
      index: context.ELASTIC_TRANSCRIPTION_INDEX,
      document: transcriptionDoc,
      id: event.transcript_sid,
    });

    console.log(
      `Inserted into Operator Results index [${context.ELASTIC_TRANSCRIPTION_INDEX}]`
    );

    response.setBody({ status: "complete" });
    return callback(null, response);
  } catch (e: any) {
    console.error(`Error ingesting data, see error reason`);
    response.setStatusCode(500);
    response.setBody(e);
    console.error(e);
    return callback(null, response);
  }
};
