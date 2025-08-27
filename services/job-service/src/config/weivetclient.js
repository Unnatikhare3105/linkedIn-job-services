import weaviate from "weaviate-client";

const client = weaviate.client({
  scheme: "https", // or "http" if local
  host: process.env.WEAVIATE_HOST.replace("https://", ""),
  apiKey: process.env.WEAVIATE_API_KEY 
    ? new weaviate.ApiKey(process.env.WEAVIATE_API_KEY)
    : undefined,
});

console.log(await client.schema.get());
