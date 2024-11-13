// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { HfInference } from "@huggingface/inference";

type MyContext = {
  ACCOUNT_SID: string;
  AUTH_TOKEN: string;
  OPENAI_API_KEY: string;
  HF_API_TOKEN: string;
  HF_EMBEDDINGS_MODEL: string;
};

type MyEvent = {
  query: string;
};

export const handler: ServerlessFunctionSignature<MyContext, MyEvent> =
  async function (
    context: Context<MyContext>,
    event: MyEvent,
    callback: ServerlessCallback
  ) {
    const response = new Twilio.Response();
    // Set the CORS headers to allow Flex to make an error-free HTTP request
    // to this Function
    response.appendHeader("Access-Control-Allow-Origin", "*");
    response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
    response.appendHeader("Content-Type", "application/json");

    console.log(">>> INCOMING QUERY REQUEST >>>");
    console.log(event);

    // Ignore events for recordings that aren't completed
    if (!event.query) {
      console.error("Missing query in request");
      response.setBody({ status: "Missing required params" });
      response.setStatusCode(400);
      return callback(null, response);
    }

    try {
      const hf = new HfInference(context.HF_API_TOKEN);

      let embeddingResp = await hf.featureExtraction({
        inputs: event.query,
        model: context.HF_EMBEDDINGS_MODEL,
      });

      console.log(
        `HuggingFace Embeddings [${context.HF_EMBEDDINGS_MODEL}] for query`,
        embeddingResp
      );
      response.setBody(embeddingResp);

      return callback(null, response);
    } catch (e: any) {
      console.error(`Error creating embedding for query, see error reason`);
      response.setStatusCode(500);
      console.error(e);
      return callback(null, response);
    }
  };
