# Voice Intelligence Elastic Search

# TODO:
- Change doc creation URL to create/update
- e.g. POST /<target>/_create/<_id>
https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html

- Remove all meta data
- Remove words from sentences

- Add Event Stream / Call hook status callback
- Add Call recording status callback
- Add Transcription webhook

- Add enrich profiles and ingestion pipelines for Call / Recording / Studio Metadata
https://www.elastic.co/guide/en/elasticsearch/reference/8.14/match-enrich-policy-type.html



## Core Setup
1. Install docker
2. Stand up ELK stack
3. Set passwords
4. Create API Key
5. Set API Key settings
6. Create index templates
7. Create indexes
8. Insert data

## Sequence
```
sequenceDiagram
critical Call occurs
    Caller->>+Prog Voice: New Call
    Prog Voice ->>+Studio: Start Call
    Studio->>Task Router: Route Call
    Task Router->>Flex: Reservation/Task
    Flex-->>Task Router: Accept Task
    Flex-->>Prog Voice: On Accept Task, Record
    
end
    Note over Caller,Flex: Interaction occurs
    Prog Voice-->>Caller: Call Ended
    Prog Voice->>+Voice Intelligence: Process Call
    Voice Intelligence->>Voice Intelligence: Apply Process Call
    Voice Intelligence->>3rd Party System: Transcript Available
    Voice Intelligence-->>-Prog Voice: Complete
    3rd Party System->>Voice Intelligence: Fetch {transcript}/sentences.json
    Voice Intelligence-->>3rd Party System: Call transcript
```


### Resources
https://opster.com/guides/elasticsearch/data-architecture/index-composable-templates/


# Create API Key

```json
{
  "vintel-key-role": {
    "cluster": [
      "all"
    ],
    "indices": [
      {
        "names": [
          "vintel",
          "admin",
          "sentences"
        ],
        "privileges": [
          "all"
        ],
        "allow_restricted_indices": true
      }
    ],
    "applications": [],
    "run_as": [],
    "metadata": {},
    "transient_metadata": {
      "enabled": true
    }
  }
}
```

# Sentences
Use the following to create a `twilio-vintel-sentences` index with mappings for certain fields. By default elastic search will create the index based on the first input document, however as there are some fields that can be either a float or a long, we need to explicitly create a mapping to the correct data type otherwise an error will be thrown and the document will not be ingested.

## Mapping

```json
PUT /twilio-vintel-sentences
{
  "mappings": {
    "properties": {
      "sentences.words.from":    { "type": "float" },
      "sentences.words.to":    { "type": "float" },
       "meta.embedding": {
        "type": "dense_vector"
       }
    }
  }
}
```

# Semantic Search

## Embeddings

### Open AI

```ts
  const openai = new OpenAI({
    apiKey: context.OPENAI_API_KEY,
  });

  let embeddingResp = await openai.embeddings.create({
    input: event.query,
    model: context.OPENAI_EMBEDDINGS_MODEL,
  });
  ```

### Hugging Face

```ts
const hf = new HfInference(context.HF_API_TOKEN);

let embeddingResp = await hf.featureExtraction({
  inputs: event.query,
  model: context.HF_EMBEDDINGS_MODEL,
   });
```

## kNN (k-Nearest Neighbour)

https://www.elastic.co/guide/en/elasticsearch/reference/current/knn-search.html


## Search example

http://localhost:2000/api/similar_transcripts?query=customer ordering a taxi&similarity=0.3

