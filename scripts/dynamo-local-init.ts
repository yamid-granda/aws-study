// Idempotent local table setup (mirrors template.yaml ProductsTable:
// PAY_PER_REQUEST, HASH key `id (S)`). Uses the AWS SDK directly so local
// development needs no AWS CLI or cloud credentials.
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

const tableName: string = process.env.TABLE_NAME ?? "aws-study-local-products";
const endpoint: string = process.env.DYNAMODB_URL ?? "http://localhost:8000";
const region: string = process.env.AWS_REGION ?? "us-east-1";

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

async function main(): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }), {
      abortSignal: AbortSignal.timeout(20_000),
    });
    console.log(`Table '${tableName}' already exists — keeping existing data.`);
  } catch (err) {
    if (!(err instanceof Error) || err.name !== "ResourceNotFoundException") {
      throw err;
    }
    console.log(`Creating table '${tableName}' ...`);
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName });
    console.log(`Table '${tableName}' created.`);
  }

  const tables = await client.send(new ListTablesCommand({}), {
    abortSignal: AbortSignal.timeout(20_000),
  });
  console.log("Local tables:", JSON.stringify(tables.TableNames));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
