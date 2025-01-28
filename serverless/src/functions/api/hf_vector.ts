// Imports global types
import "@twilio-labs/serverless-runtime-types";
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { HfInference } from "@huggingface/inference";

type MyContext = {
  HF_API_TOKEN: string;
  HF_MODEL: string;
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

  console.log(">>> INCOMING QUERY REQUEST >>>");
  console.log(event);

  try {
    const hf = new HfInference(context.HF_API_TOKEN);

    let res = await hf.featureExtraction({
      inputs: "just to confirm is the delivery address still",
      model: context.HF_MODEL,
    });

    console.log(`Hugging Face Response`, res);
    response.setBody(res);

    return callback(null, response);
  } catch (e: any) {
    console.error(`Error ingesting data, see error reason`);
    response.setStatusCode(500);
    console.error(e);
    return callback(null, response);
  }
};
